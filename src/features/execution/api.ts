export type RunOperation = 'run'
export type RunTaskStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface CreateRunRequest {
  workspace_id: string
  workspace_revision: number
  idempotency_key: string
  operation: RunOperation
  stdin: string
}

export interface RunTask {
  id: string
  workspace_id: string
  workspace_revision: number
  request_hash: string
  operation: RunOperation
  source_hash: string
  status: RunTaskStatus
  created_at: number
}

export class RunTaskApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'RunTaskApiError'
  }
}

/** Create an idempotent task from one saved workspace revision. */
export async function createRunTask(
  request: CreateRunRequest,
  fetcher: typeof fetch = fetch,
): Promise<RunTask> {
  const response = await fetcher('/api/v1/runs', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
    signal: requestTimeout(),
  })
  if (!response.ok) throw await responseError(response)
  return parseRunTask(await readJson(response))
}

/** Read one server task without accepting incomplete or unknown response states. */
export async function readRunTask(
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<RunTask> {
  const response = await fetcher(`/api/v1/runs/${encodeURIComponent(id)}`, {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: requestTimeout(),
  })
  if (!response.ok) throw await responseError(response)
  return parseRunTask(await readJson(response))
}

/** Bound each request so a disconnected API cannot leave the editor loading forever. */
function requestTimeout(): AbortSignal {
  return AbortSignal.timeout(5000)
}

/** Parse only the fields needed by the editor and task receipt. */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new RunTaskApiError(
      'The run API returned invalid JSON',
      response.status,
    )
  }
}

/** Validate every public field before treating a response as a task receipt. */
function parseRunTask(value: unknown): RunTask {
  if (!value || typeof value !== 'object') {
    throw new RunTaskApiError('The run API returned an invalid task')
  }
  const task = value as Partial<RunTask>
  if (
    typeof task.id !== 'string' ||
    typeof task.workspace_id !== 'string' ||
    typeof task.workspace_revision !== 'number' ||
    typeof task.request_hash !== 'string' ||
    task.operation !== 'run' ||
    typeof task.source_hash !== 'string' ||
    !['queued', 'running', 'succeeded', 'failed'].includes(task.status ?? '') ||
    typeof task.created_at !== 'number'
  ) {
    throw new RunTaskApiError('The run API returned an incomplete task')
  }
  return task as RunTask
}

/** Surface a safe server message without exposing raw response content. */
async function responseError(response: Response): Promise<RunTaskApiError> {
  let message = 'Could not submit the run task'
  try {
    const body = (await response.json()) as { message?: unknown }
    if (typeof body.message === 'string' && body.message.trim()) {
      message = body.message
    }
  } catch {
    // Keep the generic message when a proxy returns a non-JSON response.
  }
  return new RunTaskApiError(message, response.status)
}
