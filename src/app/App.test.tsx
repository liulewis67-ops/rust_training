import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

// 清理订阅与浏览器状态，防止课程路径和主题污染后续场景。
afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.replaceState({}, '', '/')
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
