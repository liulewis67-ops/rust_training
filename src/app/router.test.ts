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

// 首页恢复最近课程，直接课程链接优先于存储。
it('区分首页恢复与直接链接', () => {
  expect(readRoute('/', 'borrowing')).toEqual({
    page: 'lesson',
    lessonId: 'borrowing',
  })
  expect(readRoute('/lesson/ownership', 'borrowing')).toEqual({
    page: 'lesson',
    lessonId: 'ownership',
  })
})
