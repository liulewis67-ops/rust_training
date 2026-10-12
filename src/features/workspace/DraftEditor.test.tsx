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
    expect(screen.getByRole('status').textContent).toBe('当前使用课程示例')
  })

  fireEvent.change(editor, { target: { value: edited } })
  await waitFor(() => {
    expect(screen.getByRole('status').textContent).toContain('已保存到此设备')
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
    expect(screen.getByRole('status').textContent).toBe('当前使用课程示例')
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
    expect(screen.getByRole('status').textContent).toBe('当前使用课程示例')
  })
  fireEvent.change(editor, {
    target: { value: 'fn example() { old_draft(); }' },
  })
  await waitFor(() => {
    expect(screen.getByRole('status').textContent).toContain('已保存到此设备')
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
  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toBe('已保存到此设备'),
  )
  expect(screen.queryByText('云端已同步')).toBeNull()
})
