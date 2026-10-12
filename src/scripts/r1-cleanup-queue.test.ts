import { expect, it } from 'vitest'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  createCleanupQueue,
  readPendingCleanupRecord,
} from '../../scripts/r1-cleanup-queue.mjs'

const endpoint = 'tcp://docker.example.test:2376'
const engine = { context: 'test-context', endpoint }
const id = 'a'.repeat(32)

// A record removed by another process after directory listing is already acknowledged.
it('treats a missing pending file as concurrent acknowledgment', async () => {
  await withQueue(async (queuePath) => {
    expect(
      await readPendingCleanupRecord(
        join(queuePath, 'already-removed.pending'),
      ),
    ).toBeUndefined()
  })
})

async function withQueue(
  run: (queuePath: string, root: string) => Promise<void>,
) {
  const root = await mkdtemp(join(tmpdir(), 'r1-cleanup-test-'))
  try {
    await run(join(root, 'queue'), root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

// Persist only resource identity and an endpoint fingerprint, then retry in dependency order.
it('persists cleanup intent and removes the record after successful recovery', async () => {
  await withQueue(async (queuePath, root) => {
    const removed: string[] = []
    let clock = 1_700_000_000_000
    const queue = createCleanupQueue({
      queuePath,
      leaseTtlMs: 100,
      now: () => clock,
      removeDockerResource: async (kind, name) => {
        removed.push(`${kind}:${name}`)
      },
      removeTemporaryDirectory: async (name) => {
        removed.push(`directory:${name}`)
      },
    })
    const lease = await queue.createLease(engine)
    const volume = `rust-r1-${id}`
    const container = `${volume}-run`
    const pendingPaths = await Promise.all([
      queue.enqueue({
        kind: 'directory',
        name: volume,
        ...engine,
        leaseId: lease.id,
      }),
      queue.enqueue({
        kind: 'volume',
        name: volume,
        ...engine,
        leaseId: lease.id,
      }),
      queue.enqueue({
        kind: 'container',
        name: container,
        ...engine,
        leaseId: lease.id,
      }),
    ])
    const serialized = await readFile(pendingPaths[0], 'utf8')

    expect(serialized).not.toContain(endpoint)
    expect(JSON.parse(serialized).endpointHash).toMatch(/^[a-f0-9]{64}$/)
    expect(JSON.parse(serialized).leaseId).toBe(lease.id)
    clock += 101
    await queue.retry({ context: 'renamed-context', endpoint })

    expect(removed).toEqual([
      `container:${container}`,
      `volume:${volume}`,
      `directory:${volume}`,
    ])
    expect(await readdir(queuePath)).toEqual([])
    expect(await readdir(root)).toEqual(['queue'])
  })
})

// Failed cleanup must leave its durable record available for a later retry.
it('keeps failed resources queued and removes them after a later successful retry', async () => {
  await withQueue(async (queuePath) => {
    let shouldFail = true
    let clock = 1_700_000_000_000
    const queue = createCleanupQueue({
      queuePath,
      leaseTtlMs: 100,
      now: () => clock,
      removeDockerResource: async () => {
        if (shouldFail) throw new Error('temporary Docker error')
      },
      removeTemporaryDirectory: async () => {},
    })
    const lease = await queue.createLease(engine)
    const volume = `rust-r1-${id}`
    await queue.enqueue({
      kind: 'volume',
      name: volume,
      ...engine,
      leaseId: lease.id,
    })

    clock += 101
    await expect(queue.retry(engine)).rejects.toThrow('temporary Docker error')
    expect(
      (await readdir(queuePath)).filter((name) => name.endsWith('.pending')),
    ).toHaveLength(1)

    shouldFail = false
    await queue.retry(engine)
    expect(
      (await readdir(queuePath)).filter((name) => name.endsWith('.pending')),
    ).toHaveLength(0)
  })
})

// A failed container must leave its dependent volume and host directory queued.
it('preserves dependent cleanup records until container removal succeeds', async () => {
  await withQueue(async (queuePath) => {
    let containerRemovalFails = true
    let clock = 1_700_000_000_000
    const removed: string[] = []
    const queue = createCleanupQueue({
      queuePath,
      leaseTtlMs: 100,
      now: () => clock,
      removeDockerResource: async (kind, name) => {
        removed.push(`${kind}:${name}`)
        if (kind === 'container' && containerRemovalFails) {
          throw new Error('container is still running')
        }
      },
      removeTemporaryDirectory: async (name) => {
        removed.push(`directory:${name}`)
      },
    })
    const lease = await queue.createLease(engine)
    const volume = `rust-r1-${id}`
    await queue.enqueue({
      kind: 'directory',
      name: volume,
      ...engine,
      leaseId: lease.id,
    })
    await queue.enqueue({
      kind: 'volume',
      name: volume,
      ...engine,
      leaseId: lease.id,
    })
    await queue.enqueue({
      kind: 'container',
      name: `${volume}-compile`,
      ...engine,
      leaseId: lease.id,
    })

    clock += 101
    await expect(queue.retry(engine)).rejects.toThrow(
      'container is still running',
    )
    expect(removed).toEqual([`container:${volume}-compile`])
    expect(
      (await readdir(queuePath)).filter((name) => name.endsWith('.pending')),
    ).toHaveLength(3)

    containerRemovalFails = false
    removed.length = 0
    await queue.retry(engine)
    expect(removed).toEqual([
      `container:${volume}-compile`,
      `volume:${volume}`,
      `directory:${volume}`,
    ])
    expect(
      (await readdir(queuePath)).filter((name) => name.endsWith('.pending')),
    ).toHaveLength(0)
  })
})

// Live runs must survive startup recovery; expired leases become safely retryable.
it('skips resources owned by a live run and recovers them after lease expiry', async () => {
  await withQueue(async (queuePath) => {
    let clock = 1_700_000_000_000
    let arrivals = 0
    let releaseCleanup: (() => void) | undefined
    const cleanupGate = new Promise<void>((resolve) => {
      releaseCleanup = resolve
    })
    const queue = createCleanupQueue({
      queuePath,
      leaseTtlMs: 100,
      now: () => clock,
      removeDockerResource: async () => {
        arrivals += 1
        if (arrivals === 2) releaseCleanup?.()
        await cleanupGate
      },
      removeTemporaryDirectory: async () => {},
    })
    const lease = await queue.createLease(engine)
    await queue.enqueue({
      kind: 'volume',
      name: `rust-r1-${id}`,
      ...engine,
      leaseId: lease.id,
    })

    await Promise.all([queue.retry(engine), queue.retry(engine)])
    expect(arrivals).toBe(0)

    clock += 90
    await lease.heartbeat()
    clock += 20
    await Promise.all([queue.retry(engine), queue.retry(engine)])
    expect(arrivals).toBe(0)

    clock += 101
    await Promise.all([queue.retry(engine), queue.retry(engine)])

    expect(arrivals).toBe(2)
    expect(
      (await readdir(queuePath)).filter((name) => name.endsWith('.pending')),
    ).toHaveLength(0)
  })
})

// Resources targeting other endpoints remain queued and malformed records fail closed.
it('retains records for other engines and rejects malformed queued resource names', async () => {
  await withQueue(async (queuePath) => {
    const clock = 1_700_000_000_000
    const otherEndpointMessages: string[] = []
    const queue = createCleanupQueue({
      queuePath,
      leaseTtlMs: 100,
      now: () => clock,
      removeDockerResource: async () => {},
      removeTemporaryDirectory: async () => {},
      onOtherEndpoint: ({ name }) => otherEndpointMessages.push(name),
    })
    const otherLease = await queue.createLease({
      context: 'different-context',
      endpoint: 'tcp://other.example.test:2376',
    })
    const volume = `rust-r1-${id}`
    await queue.enqueue({
      kind: 'volume',
      name: volume,
      context: 'different-context',
      endpoint: 'tcp://other.example.test:2376',
      leaseId: otherLease.id,
    })

    await queue.retry(engine)
    expect(otherEndpointMessages).toEqual([volume])
    expect(
      (await readdir(queuePath)).filter((name) => name.endsWith('.pending')),
    ).toHaveLength(1)

    await writeFile(
      join(queuePath, 'malformed.pending'),
      JSON.stringify({
        kind: 'volume',
        name: '../outside',
        context: 'test',
        endpointHash: 'a'.repeat(64),
        leaseId: otherLease.id,
      }),
    )
    await expect(queue.retry(engine)).rejects.toThrow(
      'Invalid R1 cleanup queue record: malformed.pending',
    )
  })
})
