import { execFileSync } from 'node:child_process'
import { mkdir, open, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { performance } from 'node:perf_hooks'
import { pathToFileURL } from 'node:url'
import { setTimeout as delay } from 'node:timers/promises'
import { stripVTControlCharacters } from 'node:util'
import { createCleanupQueue } from './r1-cleanup-queue.mjs'

export const R1_LIMITS = Object.freeze({
  sourceBytes: 65536,
  inputBytes: 65536,
  outputBytes: 262144,
  workspaceBytes: 536870912,
  temporaryFilesystemBytes: 134217728,
  fileSizeBytes: 268435456,
  compile: Object.freeze({
    cpus: 2,
    memory: '2g',
    timeoutMs: 30000,
    pids: 128,
  }),
  run: Object.freeze({ cpus: 1, memory: '256m', timeoutMs: 5000, pids: 32 }),
})
const OUTPUT_LIMIT = R1_LIMITS.outputBytes
const SOURCE_LIMIT = R1_LIMITS.sourceBytes
const INPUT_LIMIT = R1_LIMITS.inputBytes
const COMPILE_TIMEOUT_MS = R1_LIMITS.compile.timeoutMs
const RUN_TIMEOUT_MS = R1_LIMITS.run.timeoutMs
const COMPILE_WORKSPACE_SIZE = `${R1_LIMITS.workspaceBytes / 1024 / 1024}m`
const IMAGE_CONTEXT = resolve(import.meta.dirname, '../sandbox/r1')
const CLEANUP_QUEUE = join(homedir(), '.rust-training', 'r1-cleanup')
let selectedDockerContext
let selectedDockerHost

/** Resolve Docker CLI environment precedence without changing the user's context. */
export function resolveDockerTarget({ contextEnv, hostEnv, currentContext }) {
  if (contextEnv?.trim()) {
    return { kind: 'context', context: contextEnv.trim() }
  }
  if (hostEnv?.trim()) {
    return {
      kind: 'host',
      context: 'DOCKER_HOST',
      endpoint: hostEnv.trim(),
    }
  }
  if (currentContext?.trim()) {
    return { kind: 'context', context: currentContext.trim() }
  }
  throw new Error('Docker context or DOCKER_HOST must be configured')
}

/** Redact Docker endpoint credentials and query parameters before logging. */
export function redactDockerEndpoint(endpoint) {
  return endpoint.replace(/\/\/[^/@]+@/, '//<redacted>@').replace(/[?#].*$/, '')
}

/** Keep learner output from sending terminal controls or bidirectional overrides. */
export function sanitizeTerminalOutput(value) {
  const withoutOperatingSystemCommands = String(value).replace(
    /\u001b\][^\u0007]*(?:\u0007|\u001b\\)/gu,
    '',
  )
  return stripVTControlCharacters(withoutOperatingSystemCommands)
    .replace(
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/gu,
      (character) => {
        const code = character.codePointAt(0)
        return `\\x${code.toString(16).padStart(2, '0')}`
      },
    )
    .replace(/\r(?!\n)/gu, '\\r')
    .replace(
      /[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu,
      (character) => {
        return `\\u${character.codePointAt(0).toString(16).padStart(4, '0')}`
      },
    )
}

/** Write untrusted process output as inert terminal text. */
function writeTerminalOutput(stream, value) {
  if (value) stream.write(sanitizeTerminalOutput(value))
}

/** Identifies the locally built image whose base is pinned by digest in Dockerfile. */
export const R1_IMAGE = 'rust-training-r1:1.0.0'

/** Reject non-Linux engines and require enough metadata to record the connection. */
export function validateEngineInfo({
  osType,
  version,
  context,
  endpoint,
  securityOptions,
}) {
  if (osType !== 'linux') {
    throw new Error(
      `R1 requires a Linux Docker engine; detected ${osType || 'unknown'}`,
    )
  }
  if (!version || !context || !endpoint) {
    throw new Error(
      'Docker engine version, context, and endpoint must be available',
    )
  }
  // Accept only seccomp profiles that actively filter syscalls.
  const seccompEnabled =
    Array.isArray(securityOptions) &&
    securityOptions.some(
      (option) =>
        option.startsWith('name=seccomp') &&
        !/profile=(unconfined|disabled)/i.test(option),
    )
  if (!seccompEnabled) {
    throw new Error('Docker engine must have an active seccomp profile')
  }
  // Require the profile requested on every sandbox container to be available.
  if (
    !Array.isArray(securityOptions) ||
    !securityOptions.some((option) => option.startsWith('name=apparmor'))
  ) {
    throw new Error(
      'Docker engine must support its docker-default AppArmor profile',
    )
  }
  return { osType, version, context, endpoint, securityOptions }
}

/** Reject a local image unless its ID, platform, and build labels match R1. */
export function validateImageInfo({ imageId, platform, labels }) {
  const expectedLabels = {
    'org.rust.training.rust-version': '1.95.0',
    'org.rust.training.environment-version': '1.0.0',
    'org.rust.training.base-image-digest':
      'sha256:d7482085ff5b415f84dba5647ae71606650bdef00db7aeb69f4b3d170c3e4082',
    'org.rust.training.platform': 'linux/amd64',
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(imageId)) {
    throw new Error('Docker returned an invalid R1 image ID')
  }
  if (platform !== 'linux/amd64') {
    throw new Error(`R1 image must target linux/amd64; detected ${platform}`)
  }
  for (const [key, value] of Object.entries(expectedLabels)) {
    if (labels?.[key] !== value) {
      throw new Error(`R1 image has unexpected ${key} label`)
    }
  }
  return imageId
}

/** Run one Docker CLI command with a bounded timeout and captured output. */
function docker(
  args,
  {
    timeout = 30000,
    maxBuffer = OUTPUT_LIMIT,
    input,
    allowMissing = false,
  } = {},
) {
  try {
    return execFileSync(
      'docker',
      selectedDockerContext
        ? ['--context', selectedDockerContext, ...args]
        : selectedDockerHost
          ? ['--host', selectedDockerHost, ...args]
          : args,
      {
        encoding: 'utf8',
        input,
        maxBuffer,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout,
        windowsHide: true,
      },
    )
  } catch (error) {
    const errorOutput = `${error.stderr ?? ''}${error.stdout ?? ''}`
    if (allowMissing && /no such (container|volume)/i.test(errorOutput)) {
      return ''
    }
    if (error?.code === 'ENOBUFS') {
      throw new Error(`Docker output exceeded the ${OUTPUT_LIMIT}-byte limit`)
    }
    // Preserve compiler diagnostics and runtime output when Docker exits non-zero.
    writeTerminalOutput(process.stdout, error.stdout)
    writeTerminalOutput(process.stderr, error.stderr)
    throw error
  }
}

/** Inspect and verify the R1 image produced from the pinned Dockerfile. */
function ensureImage() {
  const image = docker(['image', 'inspect', '--format={{.Id}}', R1_IMAGE], {
    timeout: 10000,
  }).trim()
  const platform = docker(
    ['image', 'inspect', '--format={{.Os}}/{{.Architecture}}', R1_IMAGE],
    { timeout: 10000 },
  ).trim()
  const labels = JSON.parse(
    docker(['image', 'inspect', '--format={{json .Config.Labels}}', R1_IMAGE], {
      timeout: 10000,
    }).trim(),
  )
  return validateImageInfo({ imageId: image, platform, labels })
}

/** Query the selected Docker endpoint and reject a Windows container engine. */
function readEngineInfo() {
  const currentContext = docker(['context', 'show'], { timeout: 10000 }).trim()
  const target = resolveDockerTarget({
    contextEnv: process.env.DOCKER_CONTEXT,
    hostEnv: process.env.DOCKER_HOST,
    currentContext,
  })
  selectedDockerContext = target.kind === 'context' ? target.context : undefined
  selectedDockerHost = target.kind === 'host' ? target.endpoint : undefined
  const { context } = target
  const endpoint =
    target.kind === 'host'
      ? target.endpoint
      : docker(
          [
            'context',
            'inspect',
            '--format={{(index .Endpoints "docker").Host}}',
            context,
          ],
          { timeout: 10000 },
        ).trim()
  const version = docker(['version', '--format={{.Server.Version}}'], {
    timeout: 10000,
  }).trim()
  const osType = docker(['info', '--format={{.OSType}}'], {
    timeout: 10000,
  }).trim()
  const securityOptions = JSON.parse(
    docker(['info', '--format={{json .SecurityOptions}}'], {
      timeout: 10000,
    }).trim(),
  )
  return validateEngineInfo({
    osType,
    version,
    context,
    endpoint,
    securityOptions,
  })
}

/** Build the small local runtime image with network disabled during build steps. */
function buildImage() {
  const buildStart = performance.now()
  docker(
    [
      'build',
      '--network=none',
      '--tag',
      R1_IMAGE,
      '--file',
      join(IMAGE_CONTEXT, 'Dockerfile'),
      IMAGE_CONTEXT,
    ],
    { timeout: 300000, maxBuffer: 1024 * 1024 },
  )
  return Math.round(performance.now() - buildStart)
}

/** Create a named volume-backed container and return its ID. */
function createContainer(options) {
  const created = docker(buildDockerCreateArgs(options), {
    timeout: 30000,
  }).trim()
  if (!/^[a-f0-9]{64}$/.test(created)) {
    throw new Error(`Docker returned an invalid container ID: ${created}`)
  }
  return created
}

/** Retry cleanup before reporting a container or temporary volume as orphaned. */
async function removeDockerObject(kind, name) {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      docker(
        kind === 'container'
          ? ['rm', '--force', name]
          : ['volume', 'rm', '--force', name],
        { timeout: 10000, allowMissing: true },
      )
      return
    } catch (error) {
      lastError = error
      writeTerminalOutput(
        process.stderr,
        `${kind}_cleanup_retry=${attempt} resource=${name}\n`,
      )
      if (attempt < 3) await delay(attempt * 250)
    }
  }
  throw new AggregateError(
    [lastError],
    `${kind} cleanup failed after 3 attempts: ${name}`,
  )
}

/** Retry removal of one generated host temporary directory. */
async function removeTemporaryDirectory(name) {
  let lastError
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await rm(join(tmpdir(), name), { recursive: true, force: true })
      return
    } catch (error) {
      lastError = error
      writeTerminalOutput(
        process.stderr,
        `directory_cleanup_retry=${attempt} resource=${name}\n`,
      )
      if (attempt < 3) await delay(attempt * 250)
    }
  }
  throw new AggregateError(
    [lastError],
    `temporary directory cleanup failed after 3 attempts: ${name}`,
  )
}

const cleanupQueue = createCleanupQueue({
  queuePath: CLEANUP_QUEUE,
  removeDockerResource: removeDockerObject,
  removeTemporaryDirectory,
  onOtherEndpoint: ({ kind, name, context }) => {
    writeTerminalOutput(
      process.stderr,
      `cleanup_pending_other_endpoint kind=${kind} resource=${name} context=${context}\n`,
    )
  },
})

/** Include nested cleanup causes in the CLI failure message. */
function describeError(error) {
  if (error instanceof AggregateError) {
    const details = []
    for (const nested of error.errors) details.push(describeError(nested))
    return `${error.message}: ${details.join('; ')}`
  }
  if (error?.code === 'ENOBUFS') {
    return `Container output exceeded the ${OUTPUT_LIMIT}-byte limit`
  }
  return error instanceof Error ? error.message : String(error)
}

/** Read a regular file through a stream capped at one byte above its limit. */
export async function readBoundedFile(
  filePath,
  limit,
  label,
  allowEmpty = false,
) {
  const handle = await open(filePath, 'r')
  try {
    const info = await handle.stat()
    if (!info.isFile()) throw new Error(`${label} must be a regular file`)
    if (info.size > limit)
      throw new Error(`${label} is limited to ${limit} bytes`)
    if (!allowEmpty && info.size === 0) {
      throw new Error(`${label} must contain at least 1 byte`)
    }
    const chunks = []
    let length = 0
    for await (const chunk of handle.createReadStream({
      start: 0,
      end: limit,
      autoClose: false,
    })) {
      length += chunk.length
      if (length > limit) {
        throw new Error(`${label} is limited to ${limit} bytes`)
      }
      chunks.push(chunk)
    }
    if (!allowEmpty && length === 0) {
      throw new Error(`${label} must contain at least 1 byte`)
    }
    return Buffer.concat(chunks, length)
  } finally {
    await handle.close()
  }
}

/** Parse a Rust source path and optional bounded stdin file from CLI arguments. */
async function readArguments(args) {
  const sourcePath = args[0]
  if (!sourcePath || sourcePath.startsWith('-')) {
    throw new Error('Usage: pnpm r1:run <source.rs> [--stdin <input-file>]')
  }
  const stdinFlag = args[1]
  const stdinPath = args[2]
  if (
    args.length > 3 ||
    (stdinFlag && stdinFlag !== '--stdin') ||
    (stdinFlag && !stdinPath)
  ) {
    throw new Error('Usage: pnpm r1:run <source.rs> [--stdin <input-file>]')
  }
  if (!sourcePath.toLowerCase().endsWith('.rs')) {
    throw new Error('Source file must use the .rs extension')
  }
  const source = await readBoundedFile(
    sourcePath,
    SOURCE_LIMIT,
    `Source file (1-${SOURCE_LIMIT} bytes)`,
  )
  const stdin = stdinPath
    ? await readBoundedFile(stdinPath, INPUT_LIMIT, 'Standard input', true)
    : Buffer.alloc(0)
  return { source, stdin }
}

/** Copy a phase's bounded output to the matching host stream. */
function forwardOutput(result) {
  writeTerminalOutput(process.stdout, result.stdout)
  writeTerminalOutput(process.stderr, result.stderr)
}

/** Build, run, and always clean up one source in isolated compile and run containers. */
async function run(sourcePath, stdinPath) {
  const args = stdinPath ? [sourcePath, '--stdin', stdinPath] : [sourcePath]
  const { source, stdin } = await readArguments(args)
  const uid = process.platform === 'win32' ? 1000 : (process.getuid?.() ?? 1000)
  const gid = process.platform === 'win32' ? 1000 : (process.getgid?.() ?? 1000)
  const suffix = randomUUID().replaceAll('-', '')
  const volumeName = `rust-r1-${suffix}`
  const stageName = `${volumeName}-stage`
  const compileName = `${volumeName}-compile`
  const runName = `${volumeName}-run`
  const sourceDirectoryName = `rust-r1-${suffix}`
  const sourceDirectory = join(tmpdir(), sourceDirectoryName)
  const sourceFile = join(sourceDirectory, 'main.rs')
  const engine = readEngineInfo()
  const safeEndpoint = redactDockerEndpoint(engine.endpoint)
  writeTerminalOutput(
    process.stderr,
    `Docker engine=${engine.osType} server=${engine.version} context=${engine.context} endpoint=${safeEndpoint}\n`,
  )
  writeTerminalOutput(
    process.stderr,
    `Docker security=${engine.securityOptions.join(',')}\n`,
  )
  await cleanupQueue.retry(engine)
  const lease = await cleanupQueue.createLease(engine)
  let compileContainer = compileName
  let runContainer = runName
  let stageContainer = stageName
  let executionError
  let volumeCleanupRecord
  let stageCleanupRecord
  let compileCleanupRecord
  let runCleanupRecord
  let sourceCleanupRecord
  let sourceDirectoryCreated = false

  try {
    sourceCleanupRecord = await cleanupQueue.enqueue({
      kind: 'directory',
      name: sourceDirectoryName,
      context: engine.context,
      endpoint: engine.endpoint,
      leaseId: lease.id,
    })
    await mkdir(sourceDirectory, { mode: 0o700 })
    sourceDirectoryCreated = true
    await writeFile(sourceFile, source, { mode: 0o600 })
    let imageTagBeforeBuild = 'present'
    try {
      docker(['image', 'inspect', '--format={{.Id}}', R1_IMAGE], {
        timeout: 10000,
      })
    } catch (error) {
      if (
        !/no such image/i.test(`${error.stderr ?? ''}${error.stdout ?? ''}`)
      ) {
        throw error
      }
      imageTagBeforeBuild = 'absent'
    }
    await lease.heartbeat()
    const imageBuildMs = buildImage()
    const imageId = ensureImage()
    writeTerminalOutput(
      process.stderr,
      `image_tag_before_build=${imageTagBeforeBuild} image_build_ms=${imageBuildMs}\n`,
    )
    writeTerminalOutput(process.stderr, `R1 image ${R1_IMAGE} (${imageId})\n`)
    volumeCleanupRecord = await cleanupQueue.enqueue({
      kind: 'volume',
      name: volumeName,
      context: engine.context,
      endpoint: engine.endpoint,
      leaseId: lease.id,
    })
    docker(buildDockerVolumeCreateArgs({ volumeName, uid, gid }), {
      timeout: 10000,
    })

    stageCleanupRecord = await cleanupQueue.enqueue({
      kind: 'container',
      name: stageName,
      context: engine.context,
      endpoint: engine.endpoint,
      leaseId: lease.id,
    })
    stageContainer = createContainer({
      phase: 'stage',
      image: R1_IMAGE,
      containerName: stageName,
      volumeName,
      uid,
      gid,
    })
    docker(['start', stageContainer], { timeout: 10000 })
    docker(['cp', sourceFile, `${stageContainer}:/workspace/main.rs`], {
      timeout: 10000,
    })

    const compileStart = performance.now()
    compileCleanupRecord = await cleanupQueue.enqueue({
      kind: 'container',
      name: compileName,
      context: engine.context,
      endpoint: engine.endpoint,
      leaseId: lease.id,
    })
    compileContainer = createContainer({
      phase: 'compile',
      image: R1_IMAGE,
      containerName: compileName,
      volumeName,
      uid,
      gid,
    })
    try {
      await lease.heartbeat()
      forwardOutput(
        docker(['start', '--attach', compileContainer], {
          timeout: COMPILE_TIMEOUT_MS,
          maxBuffer: OUTPUT_LIMIT / 2,
        }),
      )
    } finally {
      writeTerminalOutput(
        process.stderr,
        `compile_ms=${Math.round(performance.now() - compileStart)}\n`,
      )
    }
    await removeDockerObject('container', compileName)
    await cleanupQueue.acknowledge(compileCleanupRecord)
    compileContainer = ''

    const runStart = performance.now()
    runCleanupRecord = await cleanupQueue.enqueue({
      kind: 'container',
      name: runName,
      context: engine.context,
      endpoint: engine.endpoint,
      leaseId: lease.id,
    })
    runContainer = createContainer({
      phase: 'run',
      image: R1_IMAGE,
      containerName: runName,
      volumeName,
      uid,
      gid,
    })
    try {
      await lease.heartbeat()
      forwardOutput(
        docker(['start', '--attach', '--interactive', runContainer], {
          timeout: RUN_TIMEOUT_MS,
          maxBuffer: OUTPUT_LIMIT / 2,
          input: stdin,
        }),
      )
    } finally {
      writeTerminalOutput(
        process.stderr,
        `run_ms=${Math.round(performance.now() - runStart)}\n`,
      )
    }
  } catch (error) {
    executionError = error
  } finally {
    const cleanupErrors = []
    for (const [container, pendingPath] of [
      [compileName, compileCleanupRecord],
      [runName, runCleanupRecord],
      [stageName, stageCleanupRecord],
    ]) {
      if (!pendingPath) continue
      try {
        await removeDockerObject('container', container)
        await cleanupQueue.acknowledge(pendingPath)
      } catch (error) {
        cleanupErrors.push(error)
      }
    }
    if (volumeCleanupRecord) {
      try {
        await removeDockerObject('volume', volumeName)
        await cleanupQueue.acknowledge(volumeCleanupRecord)
      } catch (error) {
        cleanupErrors.push(error)
      }
    }
    try {
      if (sourceDirectoryCreated) {
        await removeTemporaryDirectory(sourceDirectoryName)
      }
      await cleanupQueue.acknowledge(sourceCleanupRecord)
    } catch (error) {
      cleanupErrors.push(error)
    }
    try {
      await lease.close()
    } catch (error) {
      cleanupErrors.push(error)
    }
    if (cleanupErrors.length > 0) {
      if (executionError) cleanupErrors.unshift(executionError)
      throw new AggregateError(cleanupErrors, 'R1 execution or cleanup failed')
    }
  }
  if (executionError) throw executionError
}

/** Run the CLI and report failures without returning a successful exit code. */
async function main(args) {
  try {
    if (
      args.length === 0 ||
      args.length > 3 ||
      (args[1] && args[1] !== '--stdin') ||
      (args[1] === '--stdin' && !args[2])
    ) {
      throw new Error('Usage: pnpm r1:run <source.rs> [--stdin <input-file>]')
    }
    await run(args[0], args[1] ? args[2] : undefined)
  } catch (error) {
    writeTerminalOutput(
      process.stderr,
      `R1 runner failed: ${describeError(error)}\n`,
    )
    process.exitCode = 1
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  // Keep imported argument builders inert when Vitest loads this module.
  await main(process.argv.slice(2))
}

/** Build arguments for one phase of the fixed R1 Docker environment. */
export function buildDockerCreateArgs({
  phase,
  image,
  containerName,
  volumeName,
  uid,
  gid,
}) {
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(containerName)) {
    throw new Error('Container name contains unsupported characters')
  }
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(volumeName)) {
    throw new Error('Volume name contains unsupported characters')
  }
  if (
    !Number.isSafeInteger(uid) ||
    uid < 1 ||
    !Number.isSafeInteger(gid) ||
    gid < 1
  ) {
    throw new Error('Container UID and GID must be positive integers')
  }
  if (image !== R1_IMAGE) {
    throw new Error(`R1 image must be the pinned ${R1_IMAGE}`)
  }

  const compile = phase === 'compile'
  const stage = phase === 'stage'
  if (!compile && !stage && phase !== 'run') {
    throw new Error(`Unknown R1 phase: ${phase}`)
  }

  const limits = compile || stage ? R1_LIMITS.compile : R1_LIMITS.run
  const memory = limits.memory
  const cpu = String(limits.cpus)
  const pids = String(limits.pids)
  const workspaceMount =
    compile || stage
      ? `type=volume,src=${volumeName},dst=/workspace`
      : `type=volume,src=${volumeName},dst=/workspace,readonly`

  return [
    'create',
    '--interactive',
    '--name',
    containerName,
    '--network=none',
    '--ipc=none',
    '--read-only',
    '--init',
    '--cap-drop=ALL',
    '--security-opt=no-new-privileges=true',
    '--security-opt=apparmor=docker-default',
    `--user=${uid}:${gid}`,
    `--memory=${memory}`,
    `--memory-swap=${memory}`,
    `--cpus=${cpu}`,
    `--pids-limit=${pids}`,
    '--ulimit=core=0:0',
    `--ulimit=fsize=${R1_LIMITS.fileSizeBytes}:${R1_LIMITS.fileSizeBytes}`,
    `--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=${R1_LIMITS.temporaryFilesystemBytes / 1024 / 1024}m,uid=${uid},gid=${gid}`,
    `--mount=${workspaceMount}`,
    '--workdir=/workspace',
    '--log-driver=none',
    '--env=HOME=/tmp',
    image,
    ...(compile
      ? [
          'rustc',
          '--edition=2024',
          '--crate-name=main',
          '/workspace/main.rs',
          '-o',
          '/workspace/program',
        ]
      : stage
        ? ['sleep', '600']
        : ['/workspace/program']),
  ]
}

/** Build arguments for the bounded tmpfs-backed workspace volume. */
export function buildDockerVolumeCreateArgs({ volumeName, uid, gid }) {
  if (!/^[a-z0-9][a-z0-9_-]{0,62}$/.test(volumeName)) {
    throw new Error('Volume name contains unsupported characters')
  }
  if (
    !Number.isSafeInteger(uid) ||
    uid < 1 ||
    !Number.isSafeInteger(gid) ||
    gid < 1
  ) {
    throw new Error('Container UID and GID must be positive integers')
  }
  return [
    'volume',
    'create',
    '--driver',
    'local',
    '--opt',
    'type=tmpfs',
    '--opt',
    'device=tmpfs',
    '--opt',
    `o=size=${COMPILE_WORKSPACE_SIZE},uid=${uid},gid=${gid}`,
    volumeName,
  ]
}
