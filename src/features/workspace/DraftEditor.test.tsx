// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
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
