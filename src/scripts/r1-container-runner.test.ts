import { expect, it } from 'vitest'
import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  buildDockerCreateArgs,
  buildDockerVolumeCreateArgs,
  R1_IMAGE,
  R1_LIMITS,
  readBoundedFile,
  redactDockerEndpoint,
  resolveDockerTarget,
  sanitizeTerminalOutput,
  validateEngineInfo,
  validateImageInfo,
} from '../../scripts/r1-container-runner.mjs'
import {
  orderCleanupRecords,
  shouldRetryCleanupRecord,
} from '../../scripts/r1-cleanup-queue.mjs'

// Follow Docker's context-over-host precedence while preserving the chosen endpoint.
it('resolves Docker context and host environment selection predictably', () => {
  expect(
    resolveDockerTarget({
      contextEnv: ' explicit-context ',
      hostEnv: 'tcp://ignored.example:2376',
      currentContext: 'default',
    }),
  ).toEqual({ kind: 'context', context: 'explicit-context' })
  expect(
    resolveDockerTarget({
      hostEnv: ' tcp://selected.example:2376 ',
      currentContext: 'default',
    }),
  ).toEqual({
    kind: 'host',
    context: 'DOCKER_HOST',
    endpoint: 'tcp://selected.example:2376',
  })
  expect(resolveDockerTarget({ currentContext: 'default' })).toEqual({
    kind: 'context',
    context: 'default',
  })
  expect(() => resolveDockerTarget({})).toThrow(
    'Docker context or DOCKER_HOST must be configured',
  )
})

// Keep secrets in custom Docker endpoint URLs out of runner diagnostics.
it('redacts Docker endpoint credentials, query parameters, and fragments', () => {
  expect(
    redactDockerEndpoint(
      'tcp://student:secret@docker.example.test:2376?token=private#fragment',
    ),
  ).toBe('tcp://<redacted>@docker.example.test:2376')
  expect(
    redactDockerEndpoint('npipe:////./pipe/dockerDesktopLinuxEngine'),
  ).toBe('npipe:////./pipe/dockerDesktopLinuxEngine')
})

// Render learner-controlled terminal sequences, carriage returns, and bidi controls inertly.
it('sanitizes untrusted output before writing it to a terminal', () => {
  expect(
    sanitizeTerminalOutput(
      '\u001b[2Jvisible\u001b]0;forged title\u0007\u0000\rnext\u202e.txt',
    ),
  ).toBe('visible\\x00\\rnext\\u202e.txt')
  expect(sanitizeTerminalOutput('first\r\nsecond\tline')).toBe(
    'first\r\nsecond\tline',
  )
})

// Release container volume mounts before removing volumes or source directories.
it('orders cleanup records without mutating the durable queue listing', () => {
  const records: Array<{
    pendingPath: string
    record: { kind: 'container' | 'volume' | 'directory' }
  }> = [
    { pendingPath: 'source.pending', record: { kind: 'directory' } },
    { pendingPath: 'volume.pending', record: { kind: 'volume' } },
    { pendingPath: 'run.pending', record: { kind: 'container' } },
    { pendingPath: 'compile.pending', record: { kind: 'container' } },
  ]

  expect(
    orderCleanupRecords(records).map(({ pendingPath }) => pendingPath),
  ).toEqual([
    'run.pending',
    'compile.pending',
    'volume.pending',
    'source.pending',
  ])
  expect(records[0].pendingPath).toBe('source.pending')
})

// Use endpoint identity for recovery while refusing a context that changed its target.
it('matches cleanup records to the original engine endpoint', () => {
  const endpoint = 'tcp://docker.example.test:2376'
  const record = {
    context: 'old-context-name',
    endpointHash: createHash('sha256').update(endpoint).digest('hex'),
  }

  expect(
    shouldRetryCleanupRecord(record, {
      context: 'renamed-context',
      endpoint,
    }),
  ).toBe(true)
  expect(
    shouldRetryCleanupRecord(record, {
      context: 'another-engine',
      endpoint: 'tcp://other.example.test:2376',
    }),
  ).toBe(false)
  expect(() =>
    shouldRetryCleanupRecord(
      { ...record, context: 'current-context' },
      { context: 'current-context', endpoint: 'tcp://changed.example.test' },
    ),
  ).toThrow('Pending R1 cleanup targets a different endpoint')
})

// Keep the published environment limits aligned with the values enforced by the runner.
it('matches the R1 environment manifest to runtime resource limits', async () => {
  const sandboxDirectory = resolve(import.meta.dirname, '../../sandbox/r1')
  const [manifestText, dockerfile, dockerignore] = await Promise.all([
    readFile(resolve(sandboxDirectory, 'environment.json'), 'utf8'),
    readFile(resolve(sandboxDirectory, 'Dockerfile'), 'utf8'),
    readFile(resolve(sandboxDirectory, '.dockerignore'), 'utf8'),
  ])
  const manifest = JSON.parse(manifestText)

  expect(manifest.compile_limits).toMatchObject({
    cpus: R1_LIMITS.compile.cpus,
    memory: R1_LIMITS.compile.memory,
    timeout_seconds: R1_LIMITS.compile.timeoutMs / 1000,
    pids: R1_LIMITS.compile.pids,
    file_size_bytes: R1_LIMITS.fileSizeBytes,
    output_bytes: R1_LIMITS.outputBytes,
    temporary_filesystem_bytes: R1_LIMITS.temporaryFilesystemBytes,
    workspace_volume_bytes: R1_LIMITS.workspaceBytes,
  })
  expect(manifest.run_limits).toMatchObject({
    cpus: R1_LIMITS.run.cpus,
    memory: R1_LIMITS.run.memory,
    timeout_seconds: R1_LIMITS.run.timeoutMs / 1000,
    pids: R1_LIMITS.run.pids,
    file_size_bytes: R1_LIMITS.fileSizeBytes,
    output_bytes: R1_LIMITS.outputBytes,
    temporary_filesystem_bytes: R1_LIMITS.temporaryFilesystemBytes,
    workspace_volume_bytes: R1_LIMITS.workspaceBytes,
    workspace_volume_readonly: true,
  })
  expect(R1_IMAGE).toBe(`rust-training-r1:${manifest.version}`)
  expect(dockerfile).toContain(
    `FROM --platform=${manifest.platform} ${manifest.base_image}@${manifest.base_image_digest}`,
  )
  expect(dockerfile).toContain(
    `LABEL org.rust.training.rust-version="${manifest.rust_version}"`,
  )
  expect(dockerfile).toContain(
    `LABEL org.rust.training.environment-version="${manifest.version}"`,
  )
  expect(dockerfile).toContain(
    `LABEL org.rust.training.base-image-digest="${manifest.base_image_digest}"`,
  )
  expect(dockerfile).toContain(
    `LABEL org.rust.training.platform="${manifest.platform}"`,
  )
  expect(dockerignore.trim().split(/\r?\n/)).toEqual(['*', '!Dockerfile'])
})

// Compilation and execution use separate resource budgets with no host mounts or network.
it('creates an isolated compile container with its fixed resource limits', () => {
  const args = buildDockerCreateArgs({
    phase: 'compile',
    image: R1_IMAGE,
    containerName: 'r1-compile-test',
    volumeName: 'r1-volume-test',
    uid: 1000,
    gid: 1000,
  })

  expect(args).toContain('--network=none')
  expect(args).toContain('--read-only')
  expect(args).toContain('--cap-drop=ALL')
  expect(args).toContain('--security-opt=no-new-privileges=true')
  expect(args).toContain('--security-opt=apparmor=docker-default')
  expect(args).toContain('--memory=2g')
  expect(args).toContain('--cpus=2')
  expect(args).toContain('--pids-limit=128')
  expect(args).toContain('--ulimit=fsize=268435456:268435456')
  // Select the bounded temporary filesystem used for compiler scratch files.
  expect(args.filter((arg) => arg.startsWith('--tmpfs='))).toEqual([
    '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=128m,uid=1000,gid=1000',
  ])
  // Require the compile workspace to use only its named temporary volume.
  expect(args.filter((arg) => arg.startsWith('--mount='))).toEqual([
    '--mount=type=volume,src=r1-volume-test,dst=/workspace',
  ])
  // Select the only environment value passed into the isolated container.
  expect(args.filter((arg) => arg.startsWith('--env='))).toEqual([
    '--env=HOME=/tmp',
  ])
  expect(args).not.toContain('--privileged')
  expect(args).not.toContain('--network=host')
})

// A running staging container keeps the tmpfs volume mounted while docker cp writes into it.
it('creates a bounded staging container with a writable compile volume', () => {
  const args = buildDockerCreateArgs({
    phase: 'stage',
    image: R1_IMAGE,
    containerName: 'r1-stage-test',
    volumeName: 'r1-volume-test',
    uid: 1000,
    gid: 1000,
  })

  expect(args).toContain('--network=none')
  expect(args).toContain('--read-only')
  expect(args).toContain('--cap-drop=ALL')
  expect(args).toContain('--security-opt=no-new-privileges=true')
  expect(args).toContain('--security-opt=apparmor=docker-default')
  expect(args).toContain('--memory=2g')
  expect(args).toContain('--cpus=2')
  expect(args).toContain('--pids-limit=128')
  expect(args).toContain('sleep')
  expect(args).toContain('600')
  expect(args.filter((arg) => arg.startsWith('--mount='))).toEqual([
    '--mount=type=volume,src=r1-volume-test,dst=/workspace',
  ])
  expect(args).not.toContain('--privileged')
  expect(args).not.toContain('--network=host')
})

// Bound actual source reads and allow empty stdin without relaxing source rules.
it('limits source and stdin file bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'r1-input-test-'))
  const sourcePath = join(directory, 'main.rs')
  const emptyInputPath = join(directory, 'empty.in')
  try {
    await writeFile(sourcePath, '12345')
    await writeFile(emptyInputPath, '')
    expect(await readBoundedFile(sourcePath, 5, 'Source file')).toEqual(
      Buffer.from('12345'),
    )
    expect(
      await readBoundedFile(emptyInputPath, 5, 'Standard input', true),
    ).toEqual(Buffer.alloc(0))
    // Reject a file that exceeds the source byte limit.
    await writeFile(sourcePath, '123456')
    await expect(readBoundedFile(sourcePath, 5, 'Source file')).rejects.toThrow(
      'Source file is limited to 5 bytes',
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

// Reject caller-controlled image references and mount-spec injection attempts.
it('keeps the image fixed and rejects unsafe resource identifiers', () => {
  const base = {
    phase: 'compile',
    image: R1_IMAGE,
    containerName: 'r1-compile-test',
    volumeName: 'r1-volume-test',
    uid: 1000,
    gid: 1000,
  } as const

  // Reject an image override before constructing Docker arguments.
  expect(() =>
    buildDockerCreateArgs({ ...base, image: 'untrusted:latest' }),
  ).toThrow('R1 image must be the pinned')
  // Reject container-name syntax that could inject Docker options.
  expect(() =>
    buildDockerCreateArgs({ ...base, containerName: 'r1,privileged=true' }),
  ).toThrow('Container name contains unsupported characters')
  // Reject a root identity so sandbox processes cannot run with UID zero.
  expect(() => buildDockerCreateArgs({ ...base, uid: 0 })).toThrow(
    'Container UID and GID must be positive integers',
  )
  // Reject volume-name syntax that could inject mount options.
  expect(() =>
    buildDockerCreateArgs({ ...base, volumeName: 'cache,readonly=false' }),
  ).toThrow('Volume name contains unsupported characters')
})

// Program execution has smaller budgets and receives the bounded build volume read-only.
it('creates a tighter run container that cannot modify compilation artifacts', () => {
  const args = buildDockerCreateArgs({
    phase: 'run',
    image: R1_IMAGE,
    containerName: 'r1-run-test',
    volumeName: 'r1-volume-test',
    uid: 1000,
    gid: 1000,
  })

  expect(args).toContain('--memory=256m')
  expect(args).toContain('--cpus=1')
  expect(args).toContain('--pids-limit=32')
  // Select the run phase's bounded temporary filesystem for scratch files.
  expect(args.filter((arg) => arg.startsWith('--tmpfs='))).toEqual([
    '--tmpfs=/tmp:rw,noexec,nosuid,nodev,size=128m,uid=1000,gid=1000',
  ])
  // Require the compiled artifact volume to be read-only while running code.
  expect(args.filter((arg) => arg.startsWith('--mount='))).toEqual([
    '--mount=type=volume,src=r1-volume-test,dst=/workspace,readonly',
  ])
  // Select the only environment value passed into the isolated container.
  expect(args.filter((arg) => arg.startsWith('--env='))).toEqual([
    '--env=HOME=/tmp',
  ])
  expect(args).toContain('/workspace/program')
  expect(args).toContain('--network=none')
})

// The shared build artifact volume is a size-bounded tmpfs, not persistent host disk.
it('creates a bounded temporary volume owned by the sandbox user', () => {
  const args = buildDockerVolumeCreateArgs({
    volumeName: 'r1-volume-test',
    uid: 1000,
    gid: 1000,
  })

  expect(args).toEqual([
    'volume',
    'create',
    '--driver',
    'local',
    '--opt',
    'type=tmpfs',
    '--opt',
    'device=tmpfs',
    '--opt',
    'o=size=512m,uid=1000,gid=1000',
    'r1-volume-test',
  ])
  // Reject mount injection in the temporary volume name.
  expect(() =>
    buildDockerVolumeCreateArgs({
      volumeName: 'cache,readonly=false',
      uid: 1000,
      gid: 1000,
    }),
  ).toThrow('Volume name contains unsupported characters')
})

// Local tags are accepted only when they describe the digest-pinned R1 image.
it('accepts only the expected image identity and pinned environment labels', async () => {
  const manifest = JSON.parse(
    await readFile(
      resolve(import.meta.dirname, '../../sandbox/r1/environment.json'),
      'utf8',
    ),
  )
  const image = {
    imageId: `sha256:${'a'.repeat(64)}`,
    platform: manifest.platform,
    labels: {
      'org.rust.training.rust-version': manifest.rust_version,
      'org.rust.training.environment-version': manifest.version,
      'org.rust.training.base-image-digest': manifest.base_image_digest,
      'org.rust.training.platform': manifest.platform,
    },
  }
  expect(validateImageInfo(image)).toBe(image.imageId)
  // Reject image labels that do not match the selected base digest.
  expect(() =>
    validateImageInfo({
      ...image,
      labels: { ...image.labels, 'org.rust.training.rust-version': '1.94.0' },
    }),
  ).toThrow('R1 image has unexpected org.rust.training.rust-version label')
  // Reject a non-amd64 image even if its other labels match.
  expect(() =>
    validateImageInfo({ ...image, platform: 'linux/arm64' }),
  ).toThrow('R1 image must target linux/amd64')
})

// Windows container engines must be rejected before any sandbox setup begins.
it('accepts only a Linux Docker engine with traceable connection metadata', () => {
  const engine = {
    osType: 'linux',
    version: '28.0.1',
    context: 'desktop-linux',
    endpoint: 'npipe:////./pipe/dockerDesktopLinuxEngine',
    securityOptions: ['name=seccomp,profile=builtin', 'name=apparmor'],
  }
  expect(validateEngineInfo(engine)).toEqual(engine)
  // Reject the Windows engine before creating any container resources.
  expect(() => validateEngineInfo({ ...engine, osType: 'windows' })).toThrow(
    'R1 requires a Linux Docker engine',
  )
  // Require all connection metadata needed for the acceptance record.
  expect(() => validateEngineInfo({ ...engine, endpoint: '' })).toThrow(
    'Docker engine version, context, and endpoint must be available',
  )
  // Reject engines where the syscall filter is disabled.
  expect(() => validateEngineInfo({ ...engine, securityOptions: [] })).toThrow(
    'Docker engine must have an active seccomp profile',
  )
  // Reject an engine that explicitly disables its syscall filter.
  expect(() =>
    validateEngineInfo({
      ...engine,
      securityOptions: ['name=seccomp,profile=unconfined', 'name=apparmor'],
    }),
  ).toThrow('Docker engine must have an active seccomp profile')
  // Require the Docker default AppArmor profile requested by the containers.
  expect(() =>
    validateEngineInfo({
      ...engine,
      securityOptions: ['name=seccomp,profile=builtin'],
    }),
  ).toThrow('Docker engine must support its docker-default AppArmor profile')
})
