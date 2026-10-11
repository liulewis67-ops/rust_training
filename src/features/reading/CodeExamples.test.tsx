import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CodeExamples } from './CodeExamples'

// 清理界面与剪贴板模拟。
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

// 剪贴板拒绝后不得显示“已复制”，重试成功后再显示成功反馈。
it('复制失败可重试且不伪报成功', async () => {
  const user = userEvent.setup()
  const write = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
    .mockResolvedValueOnce(undefined)
  render(
    <CodeExamples examples={[{ language: 'rust', code: 'let value = 1;' }]} />,
  )
  await user.click(screen.getByRole('button', { name: '复制' }))
  expect(screen.queryByRole('button', { name: '已复制' })).toBeNull()
  await user.click(screen.getByRole('button', { name: '复制失败，重试' }))
  expect(screen.getByRole('button', { name: '已复制' })).toBeTruthy()
  expect(write).toHaveBeenLastCalledWith('let value = 1;')
})
