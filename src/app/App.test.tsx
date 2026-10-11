import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

// 清理订阅与浏览器状态，防止课程路径和主题污染后续场景。
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  window.history.replaceState({}, '', '/')
})

// 数据损坏后仍可阅读和导航，并保留旧数据用于恢复。
it('损坏存储不会白屏或被导航覆盖', async () => {
  localStorage.setItem('rust-backend-training:v1', '{broken')
  const user = userEvent.setup()
  render(<App />)
  expect(screen.getByRole('alert').textContent).toContain('原数据已保留')
  await user.click(
    within(
      screen.getByRole('navigation', { name: 'Rust 学习路线' }),
    ).getAllByRole('button')[1],
  )
  expect(localStorage.getItem('rust-backend-training:v1')).toBe('{broken')
})

// 写入失败时必须在页面中提示，不能持续显示“已保存”。
it('存储额度不足时显示保存失败', async () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    // 模拟浏览器配额耗尽；主题与学习记录都要容忍失败。
    throw new DOMException('Full', 'QuotaExceededError')
  })
  const user = userEvent.setup()
  render(<App />)
  await user.click(
    within(
      screen.getByRole('navigation', { name: 'Rust 学习路线' }),
    ).getAllByRole('button')[1],
  )
  expect(screen.getByRole('alert').textContent).toContain('保存失败')
  expect(screen.queryByText('本地进度已保存')).toBeNull()
})

// 用户作答后刷新应恢复选择和反馈，避免重构丢失旧版数据。
it('作答后重新挂载恢复结果', async () => {
  const user = userEvent.setup()
  const mounted = render(<App />)
  await user.click(screen.getByRole('button', { name: /^A / }))
  await user.click(screen.getByRole('button', { name: /提交答案/ }))
  expect(screen.getByRole('button', { name: /重新作答/ })).toBeTruthy()
  mounted.unmount()
  render(<App />)
  expect(screen.getByRole('button', { name: /重新作答/ })).toBeTruthy()
})

// 浏览器导航事件必须更新页面，未知链接提供可操作恢复入口。
it('响应历史导航及未知页面恢复', async () => {
  const user = userEvent.setup()
  render(<App />)
  act(() => {
    // 模拟浏览器前进后退触发的 URL 和 popstate。
    window.history.replaceState({}, '', '/missing')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(screen.getByRole('heading', { name: '未找到课程或页面' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '返回课程目录' }))
  expect(window.location.pathname).toBe('/lesson/ownership')
})

// 移动目录支持键盘关闭，并恢复触发按钮的焦点。
it('Escape 关闭抽屉并恢复焦点', async () => {
  const user = userEvent.setup()
  render(<App />)
  const menu = screen.getByRole('button', { name: '打开课程目录' })
  await user.click(menu)
  expect(document.activeElement).toBe(
    screen.getByRole('dialog', { name: '课程目录' }),
  )
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(menu)
})

// 通过真实目录按钮验证 36 节原型可访问，并保留旧课程链接。
it('保留课程目录、旧链接和复习导航', async () => {
  const user = userEvent.setup()
  render(<App />)
  const catalog = screen.getByRole('navigation', { name: 'Rust 学习路线' })
  expect(within(catalog).getAllByRole('button')).toHaveLength(36)
  await user.click(within(catalog).getAllByRole('button')[1])
  expect(window.location.pathname).toBe('/lesson/borrowing')
  await user.click(screen.getByRole('button', { name: /薄弱点复习/ }))
  expect(screen.getByRole('heading', { name: '薄弱点复习' })).toBeTruthy()
})

// 用户切换主题后，DOM 和本地偏好必须同步，刷新时可恢复。
it('保存深浅主题偏好', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: '切换到浅色主题' }))
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(localStorage.getItem('rust-backend-training:theme')).toBe('light')
})
