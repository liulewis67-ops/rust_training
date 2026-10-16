import { expect, it } from 'vitest'
import { readRoute } from './router'

// 旧课程链接和浏览器直接进入的工具页保持兼容。
it.each(['/lesson/ownership', '/lesson/borrowing/', '/review', '/progress/'])(
  '解析有效路径 %s',
  (path) => {
    expect(readRoute(path).page).not.toBe('not-found')
  },
)

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

// Account and author-only URLs are unavailable in the public learner site.
it.each(['/login', '/register', '/preview/borrowed-text'])(
  'rejects removed feature route %s',
  (path) => expect(readRoute(path).page).toBe('not-found'),
)

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

// The manifest-published lesson stays directly addressable through a Pages-safe hash path.
it('解析已发布课包并拒绝未发布课包', () => {
  expect(readRoute('/public-lessons/borrowed-text-first-token')).toEqual({
    page: 'public-course-lesson',
    lessonId: 'borrowed-text-first-token',
  })
  expect(readRoute('/public-lessons/not-published')).toEqual({
    page: 'not-found',
    path: '/public-lessons/not-published',
  })
})
