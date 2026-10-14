// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { DraftEditor } from './DraftEditor'

/** Clear editor and database state so drafts from another test cannot leak in. */
function clearDraftDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase('rust-path-workspaces')
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
    request.onblocked = () =>
      reject(new Error('Draft database is unexpectedly blocked'))
  })
}

/** Read the editor's local persistence status independently from the run-task live region. */
function draftStatusText(): string {
  const status = document.querySelector('.draft-editor-heading [role="status"]')
  if (!status) throw new Error('Draft status should be rendered')
  return status.textContent ?? ''
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

beforeEach(async () => {
  await clearDraftDatabase()
})

// Editing autosaves, remount restores, reset preserves a recovery point, and restore recovers it.
it('saves and restores local code drafts through IndexedDB', async () => {
  const template = 'fn main() {\n    println!("starter");\n}'
  const edited = 'fn main() {\n    println!("my draft");\n}'
  const props = {
    lessonId: 'draft-editor-test',
    itemId: 'main.rs',
    label: 'main.rs',
    template,
  }
  const first = render(<DraftEditor {...props} />)
  const editor = screen.getByRole('textbox', { name: 'main.rs代码草稿' })
  await waitFor(() =>
    expect((editor as HTMLTextAreaElement).value).toBe(template),
  )
  await waitFor(() => {
    expect(draftStatusText()).toBe('当前使用课程示例')
  })

  fireEvent.change(editor, { target: { value: edited } })
  await waitFor(() => {
    expect(draftStatusText()).toContain('已保存到此设备')
  })

  first.unmount()
  const second = render(<DraftEditor {...props} />)
  const restoredEditor = screen.getByRole('textbox', {
    name: 'main.rs代码草稿',
  })
  await waitFor(() =>
    expect((restoredEditor as HTMLTextAreaElement).value).toBe(edited),
  )

  fireEvent.click(screen.getByRole('button', { name: '重置为课程示例' }))
  await waitFor(() =>
    expect((restoredEditor as HTMLTextAreaElement).value).toBe(template),
  )
  fireEvent.click(screen.getByRole('button', { name: '恢复上次编辑' }))
  await waitFor(() =>
    expect((restoredEditor as HTMLTextAreaElement).value).toBe(edited),
  )
  fireEvent.change(restoredEditor, { target: { value: template } })
  await waitFor(() => {
    expect(draftStatusText()).toBe('当前使用课程示例')
  })
  second.unmount()
  render(<DraftEditor {...props} />)
  await waitFor(() => {
    expect(
      (
        screen.getByRole('textbox', {
          name: 'main.rs代码草稿',
        }) as HTMLTextAreaElement
      ).value,
    ).toBe(template)
  })
})

// A changed starter template gets a different key and cannot be replaced by stale text.
it('starts from the new template version instead of an older draft', async () => {
  const props = {
    lessonId: 'version-isolation-test',
    itemId: 'example.rs',
    label: 'example.rs',
    template: 'fn example() {}',
  }
  const first = render(<DraftEditor {...props} />)
  const editor = screen.getByRole('textbox', { name: 'example.rs代码草稿' })
  await waitFor(() =>
    expect((editor as HTMLTextAreaElement).value).toBe(props.template),
  )
  await waitFor(() => {
    expect(draftStatusText()).toBe('当前使用课程示例')
  })
  fireEvent.change(editor, {
    target: { value: 'fn example() { old_draft(); }' },
  })
  await waitFor(() => {
    expect(draftStatusText()).toContain('已保存到此设备')
  })
  first.unmount()

  render(<DraftEditor {...props} template="fn example() { todo!() }" />)
  await waitFor(() => {
    expect(
      (
        screen.getByRole('textbox', {
          name: 'example.rs代码草稿',
        }) as HTMLTextAreaElement
      ).value,
    ).toBe('fn example() { todo!() }')
  })
})

// A second device hydrates the owner's latest cloud copy when it has no local draft.
it('restores the cloud version on a device without a local draft', async () => {
  const cloud = {
    id: 'workspace-1',
    lesson_id: 'cloud-restore-test',
    item_id: 'main.rs',
    template_version: 'starter-v1',
    content: 'fn main() { println!("cloud"); }',
    revision: 3,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('/auth/session')
        ? new Response('{"user_id":"learner-a"}', { status: 200 })
        : new Response(JSON.stringify(cloud), { status: 200 }),
    ),
  )

  render(
    <DraftEditor
      lessonId="cloud-restore-test"
      itemId="main.rs"
      label="main.rs"
      template="fn main() {}"
    />,
  )
  const editor = screen.getByRole('textbox', { name: 'main.rs代码草稿' })
  await waitFor(() =>
    expect((editor as HTMLTextAreaElement).value).toBe(cloud.content),
  )
  expect(screen.getByText('云端已同步')).toBeTruthy()
})

// A stale save displays both preserved versions and never presents cloud success.
it('shows both copies when a cloud save conflicts with a newer revision', async () => {
  const cloud = {
    id: 'workspace-2',
    lesson_id: 'cloud-conflict-test',
    item_id: 'main.rs',
    template_version: 'starter-v1',
    content: 'fn main() { println!("device one"); }',
    revision: 1,
  }
  const latest = {
    ...cloud,
    content: 'fn main() { println!("device two"); }',
    revision: 2,
  }
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    if (url.includes('/auth/session'))
      return new Response('{"user_id":"learner-a"}', { status: 200 })
    if (url.includes('/by-scope'))
      return new Response(JSON.stringify(cloud), { status: 200 })
    if (url.endsWith('/resolve'))
      return new Response(
        JSON.stringify({ ...latest, content: 'my local edit', revision: 3 }),
        { status: 200 },
      )
    return new Response(
      JSON.stringify({
        latest,
        conflict: {
          id: 'conflict-1',
          submitted_revision: 1,
          content: 'my local edit',
        },
      }),
      { status: 409 },
    )
  })
  vi.stubGlobal('fetch', fetchMock)

  render(
    <DraftEditor
      lessonId="cloud-conflict-test"
      itemId="main.rs"
      label="main.rs"
      template={cloud.content}
    />,
  )
  const editor = screen.getByRole('textbox', { name: 'main.rs代码草稿' })
  await waitFor(() => expect(screen.getByText('云端已同步')).toBeTruthy())
  fireEvent.change(editor, { target: { value: 'my local edit' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并同步' }))

  await waitFor(() =>
    expect(screen.getByText('发现冲突；云端和本机版本均保留')).toBeTruthy(),
  )
  const conflictPanel = screen.getByRole('region', { name: '草稿冲突' })
  expect(within(conflictPanel).getByText('my local edit')).toBeTruthy()
  expect(within(conflictPanel).getByText(latest.content)).toBeTruthy()
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/workspaces/workspace-2',
    expect.objectContaining({ method: 'PUT' }),
  )
  fireEvent.click(screen.getByRole('button', { name: '保留本机版本' }))
  await waitFor(() => expect(screen.getByText('云端已同步')).toBeTruthy())
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/workspaces/workspace-2/resolve',
    expect.objectContaining({ method: 'POST' }),
  )
})

// A failed cloud write remains a local save and never claims server synchronization.
it('reports cloud failure separately from a successful local save', async () => {
  const cloud = {
    id: 'workspace-3',
    lesson_id: 'cloud-failure-test',
    item_id: 'main.rs',
    template_version: 'starter-v1',
    content: 'fn main() {}',
    revision: 1,
  }
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes('/auth/session')
        ? new Response('{"user_id":"learner-a"}', { status: 200 })
        : String(input).includes('/by-scope')
          ? new Response(JSON.stringify(cloud), { status: 200 })
          : new Response(null, { status: 503 }),
    ),
  )

  render(
    <DraftEditor
      lessonId="cloud-failure-test"
      itemId="main.rs"
      label="main.rs"
      template={cloud.content}
    />,
  )
  const editor = screen.getByRole('textbox', { name: 'main.rs代码草稿' })
  await waitFor(() => expect(screen.getByText('云端已同步')).toBeTruthy())
  fireEvent.change(editor, { target: { value: 'local edit' } })
  fireEvent.click(screen.getByRole('button', { name: '保存并同步' }))

  await waitFor(() =>
    expect(screen.getByText('云端同步失败；本机草稿仍保留')).toBeTruthy(),
  )
  await waitFor(() => expect(draftStatusText()).toBe('已保存到此设备'))
  expect(screen.queryByText('云端已同步')).toBeNull()
})

// The run endpoint receives the new cloud revision only after the current editor buffer is saved.
it('saves the current editor revision before creating and reading a run task', async () => {
  const cloud = {
    id: 'workspace-run',
    lesson_id: 'run-task-test',
    item_id: 'main.rs',
    template_version: 'starter-v1',
    content: 'fn main() {}',
    revision: 1,
  }
  const edited = 'fn main() { println!("latest"); }'
  const task = {
    id: 'run-task-1',
    workspace_id: cloud.id,
    workspace_revision: 2,
    request_hash: 'request-hash',
    operation: 'run',
    source_hash: 'source-hash',
    status: 'queued',
    created_at: 1_797_000_000,
  }
  const fetchMock = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.includes('/auth/session')) {
        return new Response('{"user_id":"learner-a"}', { status: 200 })
      }
      if (url.includes('/by-scope')) {
        return new Response(JSON.stringify(cloud), { status: 200 })
      }
      if (url === `/api/v1/workspaces/${cloud.id}` && init?.method === 'PUT') {
        return new Response(
          JSON.stringify({ ...cloud, content: edited, revision: 2 }),
          { status: 200 },
        )
      }
      if (url === '/api/v1/runs' && init?.method === 'POST') {
        return new Response(JSON.stringify(task), { status: 201 })
      }
      if (url === `/api/v1/runs/${task.id}`) {
        return new Response(JSON.stringify(task), { status: 200 })
      }
      throw new Error(`Unexpected request: ${url}`)
    },
  )
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('crypto', { randomUUID: () => 'attempt-run-1' })

  render(
    <DraftEditor
      lessonId="run-task-test"
      itemId="main.rs"
      label="main.rs"
      template={cloud.content}
    />,
  )
  const editor = screen.getByRole('textbox', { name: 'main.rs代码草稿' })
  await waitFor(() => expect(screen.getByText('云端已同步')).toBeTruthy())
  fireEvent.change(editor, { target: { value: edited } })
  fireEvent.click(screen.getByRole('button', { name: '提交运行' }))

  await waitFor(() =>
    expect(screen.getByText(/任务 run-task-1 已进入队列/)).toBeTruthy(),
  )
  const putIndex = fetchMock.mock.calls.findIndex(
    ([url, init]) =>
      String(url) === `/api/v1/workspaces/${cloud.id}` &&
      init?.method === 'PUT',
  )
  const postIndex = fetchMock.mock.calls.findIndex(
    ([url, init]) => String(url) === '/api/v1/runs' && init?.method === 'POST',
  )
  expect(putIndex).toBeGreaterThan(-1)
  expect(postIndex).toBeGreaterThan(putIndex)
  expect(JSON.parse(String(fetchMock.mock.calls[putIndex][1]?.body))).toEqual({
    revision: 1,
    content: edited,
  })
  expect(JSON.parse(String(fetchMock.mock.calls[postIndex][1]?.body))).toEqual({
    workspace_id: cloud.id,
    workspace_revision: 2,
    idempotency_key: 'attempt-run-1',
    operation: 'run',
    stdin: '',
  })
})
