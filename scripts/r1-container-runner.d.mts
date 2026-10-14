/** Locally built R1 environment tag, based on the digest-pinned Rust image. */
export const R1_IMAGE: 'rust-training-r1:1.0.0'

/** Runtime limits shared with the checked-in R1 environment manifest. */
export const R1_LIMITS: Readonly<{
  sourceBytes: number
  inputBytes: number
  outputBytes: number
  workspaceBytes: number
  temporaryFilesystemBytes: number
  fileSizeBytes: number
  compile: Readonly<{
    cpus: number
    memory: string
    timeoutMs: number
    pids: number
  }>
  run: Readonly<{
    cpus: number
    memory: string
    timeoutMs: number
    pids: number
  }>
}>

/** Resolve DOCKER_CONTEXT/DOCKER_HOST precedence without mutating Docker config. */
export function resolveDockerTarget(input: {
  contextEnv?: string
  hostEnv?: string
  currentContext?: string
}):
  | { kind: 'context'; context: string }
  | { kind: 'host'; context: 'DOCKER_HOST'; endpoint: string }

/** Redact endpoint credentials and query parameters before diagnostic logging. */
export function redactDockerEndpoint(endpoint: string): string

/** Remove terminal control sequences and escape other unsafe output characters. */
export function sanitizeTerminalOutput(value: string): string

/** Reject unsupported engines and validate metadata needed for environment evidence. */
export function validateEngineInfo(info: {
  osType: string
  version: string
  context: string
  endpoint: string
  securityOptions: string[]
}): {
  osType: string
  version: string
  context: string
  endpoint: string
  securityOptions: string[]
}

/** Validate the local image ID, platform, and pinned environment labels. */
export function validateImageInfo(info: {
  imageId: string
  platform: string
  labels: Record<string, string>
}): string

/** Build the Docker CLI arguments for an isolated R1 compile or run container. */
export function buildDockerCreateArgs(options: {
  phase: 'compile' | 'run'
  image: string
  containerName: string
  volumeName: string
  uid: number
  gid: number
}): string[]

/** Build arguments for a bounded tmpfs-backed workspace volume. */
export function buildDockerVolumeCreateArgs(options: {
  volumeName: string
  uid: number
  gid: number
}): string[]

/** Read a regular file without consuming more than its configured byte limit. */
export function readBoundedFile(
  filePath: string,
  limit: number,
  label: string,
  allowEmpty?: boolean,
): Promise<Buffer>
