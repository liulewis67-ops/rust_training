export interface CloudDraftScope {
  lesson_id: string
  item_id: string
  template_version: string
}

export interface CloudDraft {
  id: string
  lesson_id: string
  item_id: string
  template_version: string
  content: string
  revision: number
}

export interface CloudDraftConflict {
  id: string
  submitted_revision: number
  content: string
}

export type CloudSession =
  | { kind: 'signed-out' }
  | { kind: 'signed-in'; userId: string }

export class CloudDraftError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'CloudDraftError'
  }
}

export class CloudDraftConflictError extends CloudDraftError {
  constructor(
    readonly latest: CloudDraft,
    readonly conflict: CloudDraftConflict,
  ) {
    super('Workspace revision conflict', 409)
    this.name = 'CloudDraftConflictError'
  }
}

/** Read the server session so local drafts can be isolated by authenticated owner. */
export async function readCloudSession(
  fetcher: typeof fetch = fetch,
): Promise<CloudSession> {
  const session = await fetcher('/api/v1/auth/session', {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: requestTimeout(),
  })
  if (session.status === 401) return { kind: 'signed-out' }
  if (!session.ok) {
    throw new CloudDraftError(
      'Could not read the signed-in session',
      session.status,
    )
  }
  const body = await readJson<{ user_id?: unknown }>(session)
  if (typeof body.user_id !== 'string' || body.user_id.trim().length === 0) {
    throw new CloudDraftError('The session response did not include an owner')
  }
  return { kind: 'signed-in', userId: body.user_id }
}

/** Find the current user's cloud draft or create it from this device's saved draft. */
export async function initializeCloudDraft(
  scope: CloudDraftScope,
  initialContent: string,
  fetcher: typeof fetch = fetch,
  expectedUserId?: string,
): Promise<{ kind: 'signed-out' } | { kind: 'ready'; workspace: CloudDraft }> {
  const session = await readCloudSession(fetcher)
  if (session.kind === 'signed-out') return { kind: 'signed-out' }
  if (expectedUserId && session.userId !== expectedUserId) {
    throw new CloudDraftError('The signed-in account changed during setup', 401)
  }

  const query = new URLSearchParams({
    lesson_id: scope.lesson_id,
    item_id: scope.item_id,
    template_version: scope.template_version,
  })
  const existing = await fetcher(
    `/api/v1/workspaces/by-scope?${query.toString()}`,
    {
      credentials: 'same-origin',
      cache: 'no-store',
      signal: requestTimeout(),
    },
  )
  if (existing.ok) {
    return { kind: 'ready', workspace: await readJson<CloudDraft>(existing) }
  }
  if (existing.status !== 404) {
    throw await responseError(existing)
  }

  const created = await fetcher('/api/v1/workspaces', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...scope, content: initialContent }),
    signal: requestTimeout(),
  })
  if (!created.ok) throw await responseError(created)
  return { kind: 'ready', workspace: await readJson<CloudDraft>(created) }
}

/** Save one draft against its last observed revision without hiding conflicts. */
export async function saveCloudDraft(
  workspace: CloudDraft,
  content: string,
  fetcher: typeof fetch = fetch,
): Promise<CloudDraft> {
  return writeCloudDraft(workspace, content, 'PUT', fetcher)
}

/** Keep this device's version while the server archives the displaced cloud copy. */
export async function resolveCloudDraft(
  workspace: CloudDraft,
  content: string,
  fetcher: typeof fetch = fetch,
): Promise<CloudDraft> {
  return writeCloudDraft(workspace, content, 'POST', fetcher, '/resolve')
}

/** Send a revision-checked save or explicit conflict resolution. */
async function writeCloudDraft(
  workspace: CloudDraft,
  content: string,
  method: 'PUT' | 'POST',
  fetcher: typeof fetch,
  suffix = '',
): Promise<CloudDraft> {
  const response = await fetcher(
    `/api/v1/workspaces/${encodeURIComponent(workspace.id)}${suffix}`,
    {
      method,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision: workspace.revision, content }),
      signal: requestTimeout(),
    },
  )
  if (response.status === 409) {
    const body = await readJson<{
      latest: CloudDraft
      conflict: CloudDraftConflict
    }>(response)
    throw new CloudDraftConflictError(body.latest, body.conflict)
  }
  if (!response.ok) throw await responseError(response)
  return readJson<CloudDraft>(response)
}

/** Bound each API request so an offline service cannot leave the editor loading forever. */
function requestTimeout(): AbortSignal {
  return AbortSignal.timeout(5000)
}

/** Parse a successful JSON response and return a stable error if the body is malformed. */
async function readJson<Result>(response: Response): Promise<Result> {
  try {
    return (await response.json()) as Result
  } catch {
    throw new CloudDraftError(
      'The workspace API returned invalid JSON',
      response.status,
    )
  }
}

/** Read a safe API message without exposing raw responses or server diagnostics. */
async function responseError(response: Response): Promise<CloudDraftError> {
  let message = 'Cloud workspace is unavailable'
  try {
    const body = (await response.json()) as { message?: unknown }
    if (typeof body.message === 'string' && body.message.length > 0) {
      message = body.message
    }
  } catch {
    // Keep the generic message when a proxy returns a non-JSON error response.
  }
  return new CloudDraftError(message, response.status)
}
