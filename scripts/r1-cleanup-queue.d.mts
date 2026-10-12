export type CleanupResourceKind = 'container' | 'volume' | 'directory'

export interface CleanupRecord {
  kind: CleanupResourceKind
  name: string
  context: string
  endpointHash: string
  leaseId: string
}

/** Maximum time since heartbeat before an interrupted run becomes recoverable. */
export const CLEANUP_LEASE_TTL_MS: number

/** Sort pending cleanup records to release containers before their volumes. */
export function orderCleanupRecords<
  T extends {
    pendingPath: string
    record: Pick<CleanupRecord, 'kind'>
  },
>(records: T[]): T[]

/** Match a queued resource against an endpoint without exposing its address. */
export function shouldRetryCleanupRecord(
  record: Pick<CleanupRecord, 'context' | 'endpointHash'>,
  engine: { context: string; endpoint: string },
): boolean

/** Read a queued resource, ignoring a record removed by another runner. */
export function readPendingCleanupRecord(
  pendingPath: string,
): Promise<unknown | undefined>

/** Create a durable cleanup queue with injected resource removal handlers. */
export function createCleanupQueue(options: {
  queuePath: string
  removeDockerResource: (
    kind: Exclude<CleanupResourceKind, 'directory'>,
    name: string,
  ) => Promise<void>
  removeTemporaryDirectory: (name: string) => Promise<void>
  onOtherEndpoint?: (record: CleanupRecord) => void
  leaseTtlMs?: number
  now?: () => number
}): {
  createLease(input: { context: string; endpoint: string }): Promise<{
    id: string
    heartbeat(): Promise<void>
    close(): Promise<void>
  }>
  enqueue(input: {
    kind: CleanupResourceKind
    name: string
    context: string
    endpoint: string
    leaseId: string
  }): Promise<string>
  acknowledge(pendingPath: string | undefined): Promise<void>
  retry(engine: { context: string; endpoint: string }): Promise<void>
}
