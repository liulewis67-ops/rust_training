import { expect, it } from 'vitest'
import { readRoute } from './router'

// 旧课程链接和浏览器直接进入的工具页保持兼容。
it.each(['/lesson/ownership', '/lesson/borrowing/', '/review', '/progress/'])(
  '解析有效路径 %s',
  (path) => {
    expect(readRoute(path).page).not.toBe('not-found')
  },
)

// The author preview is reachable without changing the learner's saved course route.
it('parses the borrowed-text author preview route', () => {
  expect(readRoute('/preview/borrowed-text')).toEqual({
    page: 'course-preview',
    courseId: 'borrowed-text',
  })
})

// 无效链接不应被伪装成首课；损坏编码不能造成白屏。
it.each(['/lesson/missing', '/lesson/%E0%A4%A', '/missing', '/review/extra'])(
  '拒绝未知路径 %s',
  (path) => {
    expect(readRoute(path)).toEqual({ page: 'not-found', path })
  },
)

// 新首页与路线可直达，已有课程链接继续映射到原型课程。
it('解析首页与已规划路线', () => {
  expect(readRoute('/')).toEqual({ page: 'home' })
  expect(readRoute('/search')).toEqual({ page: 'search' })
  expect(readRoute('/tracks/rust-backend')).toEqual({
    page: 'track',
    trackSlug: 'rust-backend',
  })
})

// 本地账号页面可以通过浏览器直接访问并保持各自模式。
it.each([
  ['/login', 'login'],
  ['/register', 'register'],
  ['/verify-email', 'verify'],
  ['/forgot-password', 'forgot'],
  ['/reset-password', 'reset'],
] as const)('解析账号路由 %s', (path, mode) => {
  expect(readRoute(path)).toEqual({ page: 'auth', mode })
})

// 旧课程链接保持稳定；无效路线不能显示成可学习课程。
it('保留旧课程链接并拒绝未知路线', () => {
  expect(readRoute('/lesson/ownership')).toEqual({
    page: 'lesson',
    lessonId: 'ownership',
  })
  expect(readRoute('/tracks/unknown')).toEqual({
    page: 'not-found',
    path: '/tracks/unknown',
  })
})
