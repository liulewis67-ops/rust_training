import {
  lstat,
  mkdir,
  open,
  readdir,
  rename,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { join } from 'node:path'

export const CLEANUP_LEASE_TTL_MS = 10 * 60 * 1000

/** Hash endpoint identity so durable queue records never contain endpoint secrets. */
function fingerprintEndpoint(endpoint) {
  return createHash('sha256').update(endpoint).digest('hex')
}

/** Validate one resource entry before it can be persisted or acted on. */
function validResourceRecord(record) {
  if (
    !record ||
    !['container', 'volume', 'directory'].includes(record.kind) ||
    !/^[a-f0-9]{32}$/.test(record.leaseId)
  ) {
    return false
  }
  const validName =
    record.kind === 'container'
      ? /^rust-r1-[a-f0-9]{32}-(?:stage|compile|run)$/.test(record.name)
      : /^rust-r1-[a-f0-9]{32}$/.test(record.name)
  return (
    validName &&
    typeof record.context === 'string' &&
    record.context.length > 0 &&
    /^[a-f0-9]{64}$/.test(record.endpointHash)
  )
}

/** Validate a lease entry and bind it to its generated queue filename. */
function validLeaseRecord(record, expectedId) {
  return (
    record &&
    record.id === expectedId &&
    /^[a-f0-9]{32}$/.test(record.id) &&
    typeof record.context === 'string' &&
    record.context.length > 0 &&
    /^[a-f0-9]{64}$/.test(record.endpointHash)
  )
}

/** Sort pending cleanup so containers release their volumes before removal. */
export function orderCleanupRecords(records) {
  const priority = { container: 0, volume: 1, directory: 2 }
  return [...records].sort(
    (left, right) => priority[left.record.kind] - priority[right.record.kind],
  )
}

/** Match by endpoint identity and reject a changed target under the same context. */
export function shouldRetryCleanupRecord(record, engine) {
  const endpointMatches =
    record.endpointHash === fingerprintEndpoint(engine.endpoint)
  if (endpointMatches) return true
  if (record.context === engine.context) {
    throw new Error(
      `Pending R1 cleanup targets a different endpoint in Docker context ${engine.context}`,
    )
  }
  return false
}

/** Read one queue record, treating concurrent removal as successful acknowledgment. */
export async function readPendingCleanupRecord(pendingPath) {
  let handle
  try {
    handle = await open(pendingPath, 'r')
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined
    throw error
  }
  try {
    return JSON.parse(await handle.readFile('utf8'))
  } finally {
    await handle.close()
  }
}

/** Durable per-user queue for resources that must be removed after interruption. */
export function createCleanupQueue({
  queuePath,
  removeDockerResource,
  removeTemporaryDirectory,
  onOtherEndpoint = () => {},
  leaseTtlMs = CLEANUP_LEASE_TTL_MS,
  now = Date.now,
}) {
  if (
    typeof queuePath !== 'string' ||
    typeof removeDockerResource !== 'function' ||
    typeof removeTemporaryDirectory !== 'function' ||
    !Number.isFinite(leaseTtlMs) ||
    leaseTtlMs <= 0 ||
    typeof now !== 'function'
  ) {
    throw new Error('R1 cleanup queue requires a path and cleanup handlers')
  }

  /** Create and validate the private queue directory before reading or writing it. */
  async function ensureQueue(create) {
    if (create) await mkdir(queuePath, { recursive: true, mode: 0o700 })
    try {
      const info = await lstat(queuePath)
      if (!info.isDirectory() || info.isSymbolicLink()) {
        throw new Error('R1 cleanup queue must be a regular directory')
      }
      return true
    } catch (error) {
      if (error?.code === 'ENOENT' && !create) return false
      throw error
    }
  }

  /** Read a regular lease file and capture its last heartbeat time. */
  async function readLease(leasePath, expectedId) {
    let info
    try {
      info = await lstat(leasePath)
    } catch (error) {
      if (error?.code === 'ENOENT') return undefined
      throw error
    }
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error(`Invalid R1 cleanup lease: ${expectedId}`)
    }
    const record = await readPendingCleanupRecord(leasePath)
    if (!validLeaseRecord(record, expectedId)) {
      throw new Error(`Invalid R1 cleanup lease: ${expectedId}`)
    }
    return { record, modifiedAt: info.mtimeMs }
  }

  /** Create a lease that marks resources as active until closed or expired. */
  async function createLease({ context, endpoint }) {
    if (
      typeof context !== 'string' ||
      !context ||
      typeof endpoint !== 'string'
    ) {
      throw new Error(
        'R1 cleanup lease requires an engine context and endpoint',
      )
    }
    await ensureQueue(true)
    const id = randomUUID().replaceAll('-', '')
    const record = { id, context, endpointHash: fingerprintEndpoint(endpoint) }
    const leasePath = join(queuePath, `${id}.lease`)
    const temporaryPath = `${leasePath}.tmp`
    await writeFile(temporaryPath, JSON.stringify(record), {
      flag: 'wx',
      mode: 0o600,
    })
    await rename(temporaryPath, leasePath)
    const timestamp = new Date(now())
    await utimes(leasePath, timestamp, timestamp)
    return Object.freeze({
      id,
      heartbeat: async () => {
        const timestamp = new Date(now())
        await utimes(leasePath, timestamp, timestamp)
      },
      close: async () => rm(leasePath, { force: true }),
    })
  }

  /** Persist cleanup intent before creating its Docker or host resource. */
  async function enqueue({ kind, name, context, endpoint, leaseId }) {
    const record = {
      kind,
      name,
      context,
      endpointHash: fingerprintEndpoint(endpoint),
      leaseId,
    }
    if (!validResourceRecord(record)) {
      throw new Error('Refusing to queue an invalid R1 resource')
    }
    await ensureQueue(true)
    const pendingPath = join(queuePath, `${randomUUID()}.pending`)
    const temporaryPath = `${pendingPath}.tmp`
    await writeFile(temporaryPath, JSON.stringify(record), {
      flag: 'wx',
      mode: 0o600,
    })
    await rename(temporaryPath, pendingPath)
    return pendingPath
  }

  /** Remove a resource entry after its cleanup has succeeded. */
  async function acknowledge(pendingPath) {
    if (pendingPath) await rm(pendingPath, { force: true })
  }

  /** Recover only stale resources, leaving resources owned by active leases intact. */
  async function retry(engine) {
    if (!(await ensureQueue(false))) return
    const entries = await readdir(queuePath, { withFileTypes: true })
    const activeLeases = new Map()
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.lease')) continue
      const id = entry.name.slice(0, -'.lease'.length)
      if (!/^[a-f0-9]{32}$/.test(id)) {
        throw new Error(`Invalid R1 cleanup lease filename: ${entry.name}`)
      }
      const leasePath = join(queuePath, entry.name)
      const lease = await readLease(leasePath, id)
      if (!lease) continue
      if (!shouldRetryCleanupRecord(lease.record, engine)) continue
      if (now() - lease.modifiedAt <= leaseTtlMs) {
        activeLeases.set(id, lease.record)
      } else {
        await rm(leasePath, { force: true })
      }
    }

    const records = []
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.pending')) continue
      const pendingPath = join(queuePath, entry.name)
      const record = await readPendingCleanupRecord(pendingPath)
      if (record === undefined) continue
      if (!validResourceRecord(record)) {
        throw new Error(`Invalid R1 cleanup queue record: ${entry.name}`)
      }
      records.push({ pendingPath, record })
    }

    for (const { pendingPath, record } of orderCleanupRecords(records)) {
      if (!shouldRetryCleanupRecord(record, engine)) {
        onOtherEndpoint(record)
        continue
      }
      const lease = activeLeases.get(record.leaseId)
      if (lease) {
        if (
          lease.context !== record.context ||
          lease.endpointHash !== record.endpointHash
        ) {
          throw new Error(
            `R1 cleanup lease does not match resource ${record.name}`,
          )
        }
        continue
      }
      if (record.kind === 'directory') {
        await removeTemporaryDirectory(record.name)
      } else {
        await removeDockerResource(record.kind, record.name)
      }
      await rm(pendingPath, { force: true })
    }
  }

  return Object.freeze({ acknowledge, createLease, enqueue, retry })
}
