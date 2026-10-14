// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import type { CloudDraft } from '../workspace/cloudDrafts'
import { RunTaskPanel } from './RunTaskPanel'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// Save current editor content before POST, then confirm the authoritative receipt with GET.
it('submits a saved revision and reads its queued task status', async () => {
  const workspace: CloudDraft = {
    id: 'workspace-1',
    lesson_id: 'M01-L01',
    item_id: 'main.rs',
    template_version: 'starter-v1',
    content: 'fn main() {}',
    revision: 4,
  }
  const task = {
    id: 'run-1',
    workspace_id: workspace.id,
    workspace_revision: workspace.revision,
    request_hash: 'request-hash',
    operation: 'run',
    source_hash: 'source-hash',
    status: 'queued',
    created_at: 1_797_000_000,
  }
  const fetcher = vi.fn(async (input: RequestInfo | URL) =>
    String(input) === '/api/v1/runs'
      ? new Response(JSON.stringify(task), { status: 201 })
      : new Response(JSON.stringify(task), { status: 200 }),
  )
  vi.stubGlobal('fetch', fetcher)
  vi.stubGlobal('crypto', { randomUUID: () => 'attempt-0001' })
  const saveCurrentDraft = vi.fn(async () => workspace)

  render(
    <RunTaskPanel
      workspace={workspace}
      enabled
      saveCurrentDraft={saveCurrentDraft}
    />,
  )
  fireEvent.change(screen.getByRole('textbox', { name: '运行标准输入' }), {
    target: { value: 'stdin payload' },
  })
  fireEvent.click(screen.getByRole('button', { name: '提交运行' }))

  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('已进入队列'),
  )
  expect(saveCurrentDraft).toHaveBeenCalledOnce()
  expect(fetcher).toHaveBeenNthCalledWith(
    1,
    '/api/v1/runs',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        workspace_id: 'workspace-1',
        workspace_revision: 4,
        idempotency_key: 'attempt-0001',
        operation: 'run',
        stdin: 'stdin payload',
      }),
    }),
  )
  expect(fetcher).toHaveBeenNthCalledWith(
    2,
    '/api/v1/runs/run-1',
    expect.objectContaining({ cache: 'no-store' }),
  )
})

// A draft without a saved, authenticated workspace cannot be submitted.
it('keeps run submission disabled until a cloud workspace is ready', () => {
  render(
    <RunTaskPanel enabled={false} saveCurrentDraft={async () => undefined} />,
  )
  expect(
    (screen.getByRole('button', { name: '提交运行' }) as HTMLButtonElement)
      .disabled,
  ).toBe(true)
})
