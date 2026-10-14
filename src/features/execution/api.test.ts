import { expect, it, vi } from 'vitest'
import { createRunTask, readRunTask } from './api'

const task = {
  id: 'run-1',
  workspace_id: 'workspace-1',
  workspace_revision: 4,
  request_hash: 'request-hash',
  operation: 'run',
  source_hash: 'source-hash',
  status: 'queued',
  created_at: 1_797_000_000,
}

// Send only a fixed operation and the saved workspace revision with same-origin credentials.
it('creates an idempotent run task from a saved workspace', async () => {
  const fetcher = vi.fn(
    async () => new Response(JSON.stringify(task), { status: 201 }),
  )
  const result = await createRunTask(
    {
      workspace_id: 'workspace-1',
      workspace_revision: 4,
      idempotency_key: 'attempt-1',
      operation: 'run',
      stdin: '',
    },
    fetcher as typeof fetch,
  )

  expect(result).toEqual(task)
  expect(fetcher).toHaveBeenCalledWith(
    '/api/v1/runs',
    expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      body: JSON.stringify({
        workspace_id: 'workspace-1',
        workspace_revision: 4,
        idempotency_key: 'attempt-1',
        operation: 'run',
        stdin: '',
      }),
    }),
  )
})

// Reopen an existing task with a cache-bypassing owner-scoped GET.
it('reads the server task status by identifier', async () => {
  const fetcher = vi.fn(
    async () => new Response(JSON.stringify(task), { status: 200 }),
  )
  await expect(readRunTask('run-1', fetcher as typeof fetch)).resolves.toEqual(
    task,
  )
  expect(fetcher).toHaveBeenCalledWith(
    '/api/v1/runs/run-1',
    expect.objectContaining({
      credentials: 'same-origin',
      cache: 'no-store',
    }),
  )
})

// Reject success-shaped payloads that could falsely claim an authoritative task state.
it('rejects incomplete task responses', async () => {
  const fetcher = vi.fn(
    async () => new Response('{"id":"run-1"}', { status: 200 }),
  )
  await expect(readRunTask('run-1', fetcher as typeof fetch)).rejects.toThrow(
    'incomplete task',
  )
})
