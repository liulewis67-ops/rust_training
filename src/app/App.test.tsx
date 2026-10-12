import { afterEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

/** 从保留的旧课程 URL 挂载原型学习界面，隔离新首页行为。 */
function renderLegacyLesson() {
  window.history.replaceState({}, '', '/lesson/ownership')
  return render(<App />)
}

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
  renderLegacyLesson()
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
  renderLegacyLesson()
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
  const mounted = renderLegacyLesson()
  await user.click(screen.getByRole('button', { name: /^A / }))
  await user.click(screen.getByRole('button', { name: /提交答案/ }))
  expect(screen.getByRole('button', { name: /重新作答/ })).toBeTruthy()
  mounted.unmount()
  renderLegacyLesson()
  expect(screen.getByRole('button', { name: /重新作答/ })).toBeTruthy()
})

// 浏览器导航事件必须更新页面，未知链接提供可操作恢复入口。
it('响应历史导航及未知页面恢复', async () => {
  const user = userEvent.setup()
  renderLegacyLesson()
  act(() => {
    // 模拟浏览器前进后退触发的 URL 和 popstate。
    window.history.replaceState({}, '', '/missing')
    window.dispatchEvent(new PopStateEvent('popstate'))
  })
  expect(screen.getByRole('heading', { name: '未找到课程或页面' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '返回课程目录' }))
  expect(window.location.pathname).toBe('/lesson/ownership')
})

// The author preview is reachable from the workspace and does not become a learner lesson.
it('opens the local borrowed-text course preview', async () => {
  const user = userEvent.setup()
  renderLegacyLesson()

  await user.click(screen.getByRole('button', { name: '打开课包预览' }))

  expect(window.location.pathname).toBe('/preview/borrowed-text')
  expect(
    screen.getByRole('heading', { name: '借用文本并安全返回切片' }),
  ).toBeTruthy()
})

// 移动目录支持键盘关闭，并恢复触发按钮的焦点。
it('Escape 关闭抽屉并恢复焦点', async () => {
  const user = userEvent.setup()
  renderLegacyLesson()
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
  renderLegacyLesson()
  const catalog = screen.getByRole('navigation', { name: 'Rust 学习路线' })
  expect(within(catalog).getAllByRole('button')).toHaveLength(36)
  await user.click(within(catalog).getAllByRole('button')[1])
  expect(window.location.pathname).toBe('/lesson/borrowing')
  await user.click(screen.getByRole('button', { name: /薄弱点复习/ }))
  expect(screen.getByRole('heading', { name: '薄弱点复习' })).toBeTruthy()
})

// 已保存或外部分享的旧课程 URL 仍直接进入对应原型课程。
it('直接打开旧课程链接时显示对应课程', () => {
  window.history.replaceState({}, '', '/lesson/borrowing')
  render(<App />)

  expect(window.location.pathname).toBe('/lesson/borrowing')
  expect(screen.getByRole('heading', { name: '借用 Borrowing' })).toBeTruthy()
})

// 用户切换主题后，DOM 和本地偏好必须同步，刷新时可恢复。
it('保存深浅主题偏好', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: '切换到浅色主题' }))
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(localStorage.getItem('rust-backend-training:theme')).toBe('light')
})

// 新首页只展示方案，不沿用旧版未核验课程的完成进度。
it('展示规划中的学习路线而不显示旧课程完成数', () => {
  render(<App />)

  expect(
    screen.getByRole('heading', {
      name: '从 Rust 基础，走到可交付的后端服务。',
    }),
  ).toBeTruthy()
  expect(screen.getByText(/规划阶段不会计作已完成学习/)).toBeTruthy()
  expect(screen.queryByText(/\/ 36 节课/)).toBeNull()
  expect(screen.queryByRole('navigation', { name: 'Rust 学习路线' })).toBeNull()
})

// 主导航可进入八个明确标记为规划中的课程阶段。
it('打开路线详情并把所有阶段标为规划中', async () => {
  const user = userEvent.setup()
  render(<App />)

  await user.click(screen.getByRole('button', { name: '查看学习路线' }))

  expect(window.location.pathname).toBe('/tracks/rust-backend')
  expect(
    screen.getByRole('heading', { name: 'Rust 后端工程师路线' }),
  ).toBeTruthy()
  expect(screen.getAllByText('规划中')).toHaveLength(8)
  expect(screen.getByText('240 小时规划基准')).toBeTruthy()
})
