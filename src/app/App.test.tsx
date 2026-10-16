import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'
import { progressStorageKey } from '../features/learning/progressStorage'

/** Open a legacy lesson through the static site's hash route. */
function renderLegacyLesson() {
  window.history.replaceState({}, '', '/#/lesson/ownership')
  return render(<App />)
}

// 清理订阅与浏览器状态，防止课程路径和主题污染后续场景。
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
  window.history.replaceState({}, '', '/#/')
})

beforeEach(() => {
  // Fail accidental API work by keeping network access local to the test.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(null, { status: 401 })),
  )
  vi.stubGlobal('scrollTo', vi.fn())
})

// 数据损坏后仍可阅读和导航，并保留旧数据用于恢复。
it('损坏存储不会白屏或被导航覆盖', async () => {
  localStorage.setItem(progressStorageKey(), '{broken')
  const user = userEvent.setup()
  renderLegacyLesson()
  expect((await screen.findByRole('alert')).textContent).toContain(
    '原数据已保留',
  )
  await user.click(
    within(
      screen.getByRole('navigation', { name: 'Rust 学习路线' }),
    ).getAllByRole('button')[1],
  )
  expect(localStorage.getItem(progressStorageKey())).toBe('{broken')
})

// Focus mode removes the side panels, exposes its active state in text, and can always be exited.
it('toggles and persists the reading focus layout', async () => {
  const user = userEvent.setup()
  renderLegacyLesson()
  await user.click(screen.getByRole('button', { name: '进入专注模式' }))
  expect(
    document
      .querySelector('.app-grid')
      ?.classList.contains('app-grid-reading-focus'),
  ).toBe(true)
  expect(localStorage.getItem('rust-path:reading-focus')).toBe('true')
  const exit = screen.getByRole('button', { name: '退出专注模式' })
  expect(exit.getAttribute('aria-pressed')).toBe('true')
  await user.click(exit)
  expect(
    document
      .querySelector('.app-grid')
      ?.classList.contains('app-grid-reading-focus'),
  ).toBe(false)
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
  expect((await screen.findByRole('alert')).textContent).toContain('保存失败')
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
  expect(await screen.findByRole('button', { name: /重新作答/ })).toBeTruthy()
})

// 浏览器导航事件必须更新页面，未知链接提供可操作恢复入口。
it('响应历史导航及未知页面恢复', async () => {
  const user = userEvent.setup()
  renderLegacyLesson()
  act(() => {
    // 模拟浏览器前进后退触发的 hashchange。
    window.history.replaceState({}, '', '/#/missing')
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
  expect(screen.getByRole('heading', { name: '未找到课程或页面' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '返回课程目录' }))
  expect(window.location.hash).toBe('#/tracks/rust-backend')
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
  expect(window.location.hash).toBe('#/lesson/borrowing')
  await user.click(screen.getByRole('button', { name: /薄弱点复习/ }))
  expect(screen.getByRole('heading', { name: '薄弱点复习' })).toBeTruthy()
})

// 已保存或外部分享的旧课程 URL 仍直接进入对应原型课程。
it('直接打开旧课程链接时显示对应课程', () => {
  window.history.replaceState({}, '', '/#/lesson/borrowing')
  render(<App />)

  expect(window.location.hash).toBe('#/lesson/borrowing')
  expect(screen.getByRole('heading', { name: '借用 Borrowing' })).toBeTruthy()
})

it('已发布模块末节不会导航到未发布课程', () => {
  window.history.replaceState({}, '', '/#/courses/m01/l06')
  render(<App />)
  expect(
    screen.getByRole('heading', { name: /综合自测——从空目录交付可测试程序/ }),
  ).toBeTruthy()
  expect(screen.queryByText('下一节')).toBeNull()
})

// 用户切换主题后，DOM 和本地偏好必须同步，刷新时可恢复。
it('保存深浅主题偏好', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: '切换到浅色主题' }))
  expect(document.documentElement.dataset.theme).toBe('light')
  expect(localStorage.getItem('rust-path:theme')).toBe('light')
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

it('首页下一课进入已发布的 M01 主线', async () => {
  const user = userEvent.setup()
  render(<App />)
  const mainTrackCard = screen.getByText('主线下一课').closest('article')
  expect(mainTrackCard).toBeTruthy()
  await user.click(
    within(mainTrackCard as HTMLElement).getByRole('button', {
      name: /打开课节/,
    }),
  )
  expect(window.location.hash).toBe('#/courses/m01/l01')
  expect(
    screen.getByRole('heading', { name: 'Rust 解决的问题与路线选择' }),
  ).toBeTruthy()
})

// 课程目录展示完整路线规划，并明确标出暂无课件的条目。
it('打开课程目录并显示课程准备状态', async () => {
  const user = userEvent.setup()
  render(<App />)

  await user.click(screen.getByRole('button', { name: '浏览课程目录' }))

  expect(window.location.hash).toBe('#/tracks/rust-backend')
  expect(
    screen.getByRole('heading', { name: 'Rust 后端工程师路线' }),
  ).toBeTruthy()
  expect(screen.getByText('24 个模块')).toBeTruthy()
  expect(screen.getAllByText('课程准备中').length).toBeGreaterThan(0)
  expect(screen.getByText('约 10 小时')).toBeTruthy()
})

// Explicitly published content is reachable from the catalog without search.
it('课程目录列出清单中的公开课节', async () => {
  const user = userEvent.setup()
  render(<App />)
  await user.click(screen.getByRole('button', { name: '浏览课程目录' }))
  await user.click(
    screen.getByRole('button', { name: /借用文本并安全返回切片/ }),
  )

  expect(window.location.hash).toBe(
    '#/public-lessons/borrowed-text-first-token',
  )
  expect(
    await screen.findByRole('heading', { name: '返回文本中的第一个单词' }),
  ).toBeTruthy()
})

// 搜索页展示公开索引命中、课程定位链接和无结果恢复入口。
it('搜索中文词与错误码并可恢复空结果', async () => {
  const user = userEvent.setup()
  render(<App />)

  await user.click(screen.getByRole('button', { name: /搜索/ }))
  const input = screen.getByRole('searchbox', {
    name: '搜索课程标题、正文、术语或错误码',
  })
  await user.type(input, 'E0382')

  const ownershipResult = screen.getByRole('link', { name: /所有权 Ownership/ })
  expect(ownershipResult.getAttribute('href')).toBe('#/lesson/ownership')
  expect(screen.getByText('E0382：值被移动后再次使用')).toBeTruthy()

  await user.clear(input)
  await user.type(input, 'unknown-search-term')
  expect(screen.getByRole('heading', { name: '没有找到匹配课程' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: '查看学习路线' }))
  expect(
    screen.getByRole('heading', { name: 'Rust 后端工程师路线' }),
  ).toBeTruthy()
})

// A search result for a manifest-published pack opens in the unified hash reader.
it('从公开课包搜索结果进入课程阅读页', async () => {
  const user = userEvent.setup()
  render(<App />)

  await user.click(screen.getByRole('button', { name: /搜索/ }))
  await user.type(
    screen.getByRole('searchbox', {
      name: '搜索课程标题、正文、术语或错误码',
    }),
    '切片',
  )
  await user.click(screen.getByRole('link', { name: /返回文本中的第一个单词/ }))

  expect(window.location.hash).toBe(
    '#/public-lessons/borrowed-text-first-token',
  )
  expect(
    await screen.findByRole('heading', { name: '返回文本中的第一个单词' }),
  ).toBeTruthy()
  expect(screen.getByText(/编程练习在本地电脑完成/)).toBeTruthy()
  expect(screen.getByRole('heading', { name: '练习材料' })).toBeTruthy()
})
