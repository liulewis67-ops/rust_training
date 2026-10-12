import { expect, it } from 'vitest'
import {
  CloudDraftConflictError,
  initializeCloudDraft,
  saveCloudDraft,
  type CloudDraft,
} from './cloudDrafts'

const scope = {
  lesson_id: 'M01-L01',
  item_id: 'main.rs',
  template_version: 'starter-v1',
}

/** Build a typed fetch stub that returns the supplied ordered responses. */
function responseSequence(responses: Response[]) {
  const calls: Array<{ input: string; init?: RequestInit }> = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input: String(input), init })
    const response = responses.shift()
    if (!response) throw new Error('Unexpected cloud draft request')
    return response
  }) as typeof fetch
  return { calls, fetcher }
}

/** Create a minimal cloud workspace fixture for API response tests. */
function cloudDraft(content: string, revision = 1): CloudDraft {
  return {
    id: 'opaque-workspace-id',
    ...scope,
    content,
    revision,
  }
}

// Anonymous learners keep using IndexedDB without workspace API requests.
it('stops at the session check when signed out', async () => {
  const { calls, fetcher } = responseSequence([
    new Response(null, { status: 401 }),
  ])

  await expect(
    initializeCloudDraft(scope, 'local draft', fetcher),
  ).resolves.toEqual({
    kind: 'signed-out',
  })
  expect(calls).toHaveLength(1)
  expect(calls[0].init?.credentials).toBe('same-origin')
})

// A second device fetches by stable scope; a first device creates from its local copy.
it('creates a cloud workspace from the current local draft when none exists', async () => {
  const workspace = cloudDraft('local draft')
  const { calls, fetcher } = responseSequence([
    new Response('{"user_id":"learner-a"}', { status: 200 }),
    new Response(null, { status: 404 }),
    new Response(JSON.stringify(workspace), { status: 201 }),
  ])

  await expect(
    initializeCloudDraft(scope, 'local draft', fetcher),
  ).resolves.toEqual({ kind: 'ready', workspace })
  expect(calls[1].input).toContain(
    '/api/v1/workspaces/by-scope?lesson_id=M01-L01&item_id=main.rs&template_version=starter-v1',
  )
  expect(calls[2].init?.method).toBe('POST')
  expect(JSON.parse(String(calls[2].init?.body)).content).toBe('local draft')
})

// Revision races remain explicit and expose both the current and submitted copies.
it('surfaces latest and submitted text when a cloud save conflicts', async () => {
  const latest = cloudDraft('new cloud version', 2)
  const conflict = {
    id: 'conflict-copy-id',
    submitted_revision: 1,
    content: 'local edit',
  }
  const { calls, fetcher } = responseSequence([
    new Response(JSON.stringify({ latest, conflict }), { status: 409 }),
  ])

  const error = await saveCloudDraft(
    cloudDraft('old local version'),
    'local edit',
    fetcher,
  ).catch((caught: unknown) => caught)
  expect(error).toBeInstanceOf(CloudDraftConflictError)
  expect(error).toMatchObject({
    latest,
    conflict,
    status: 409,
  })
  expect(calls[0].init?.method).toBe('PUT')
  expect(JSON.parse(String(calls[0].init?.body))).toEqual({
    revision: 1,
    content: 'local edit',
  })
})

// A non-JSON reverse-proxy failure still produces a safe user-facing error.
it('uses a stable message when the workspace proxy returns non-JSON failure', async () => {
  const { fetcher } = responseSequence([
    new Response('{"user_id":"learner-a"}', { status: 200 }),
    new Response(null, { status: 404 }),
    new Response('upstream traceback', { status: 502 }),
  ])

  await expect(
    initializeCloudDraft(scope, 'local draft', fetcher),
  ).rejects.toThrow('Cloud workspace is unavailable')
})
