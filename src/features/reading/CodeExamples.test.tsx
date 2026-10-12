import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CodeExamples } from './CodeExamples'

// 清理界面与剪贴板模拟。
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
})

// 剪贴板拒绝后不得显示“已复制”，重试成功后再显示成功反馈。
it('复制失败可重试且不伪报成功', async () => {
  const user = userEvent.setup()
  const write = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
    .mockResolvedValueOnce(undefined)
  render(
    <CodeExamples
      lessonId="copy-test"
      examples={[{ language: 'rust', code: 'let value = 1;' }]}
    />,
  )
  await user.click(screen.getByRole('button', { name: '复制原始示例' }))
  expect(screen.queryByRole('button', { name: '已复制' })).toBeNull()
  await user.click(screen.getByRole('button', { name: '复制失败，重试' }))
  expect(screen.getByRole('button', { name: '已复制' })).toBeTruthy()
  expect(write).toHaveBeenLastCalledWith('let value = 1;')
})

// Keyboard users can reach the editor and return to the example toolbar without a pointer.
it('supports keyboard entry and exit from the code editor', async () => {
  const user = userEvent.setup()
  render(
    <CodeExamples
      lessonId="keyboard-test"
      examples={[{ language: 'rust', code: 'let value = 1;' }]}
    />,
  )
  const editor = await screen.findByRole('textbox', { name: '示例 1代码草稿' })
  await user.tab()
  expect(document.activeElement).toBe(
    screen.getByRole('button', { name: '并排阅读与编辑' }),
  )
  await user.tab()
  await user.tab()
  const copy = screen.getByRole('button', { name: '复制原始示例' })
  expect(document.activeElement).toBe(copy)
  await user.tab()
  expect(document.activeElement).toBe(editor)
  await user.tab({ shift: true })
  expect(document.activeElement).toBe(copy)
})

// Split state and its non-color explanation stay available to assistive technology.
it('toggles the resizable split layout with an explicit status', async () => {
  const user = userEvent.setup()
  render(
    <CodeExamples
      lessonId="layout-test"
      examples={[{ language: 'rust', code: 'let value = 1;' }]}
    />,
  )
  const toggle = screen.getByRole('button', { name: '并排阅读与编辑' })
  await user.click(toggle)
  expect(
    screen
      .getByRole('button', { name: '上下排列' })
      .getAttribute('aria-pressed'),
  ).toBe('true')
  expect(screen.getByText(/并排模式：左侧为课程示例/).textContent).toContain(
    '左侧为课程示例',
  )
  expect(
    screen.getByRole('slider', { name: '代码与编辑器分栏比例' }),
  ).toBeTruthy()
})
