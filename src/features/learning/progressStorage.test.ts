import { afterEach, expect, it, vi } from 'vitest'
import { createProgress } from './model'
import {
  loadProgress,
  parseProgress,
  PROGRESS_KEY,
  progressStorageKey,
  saveProgress,
} from './progressStorage'

// 每个场景单独使用本地存储，清理错误模拟。
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

// Signed-in learners never share one browser's private progress namespace.
it('uses a distinct local storage key for each server account', () => {
  expect(progressStorageKey()).toBe(PROGRESS_KEY)
  expect(progressStorageKey('learner/a')).toBe(
    `${PROGRESS_KEY}:account:learner%2Fa`,
  )
  expect(progressStorageKey('learner-a')).not.toBe(
    progressStorageKey('learner-b'),
  )
})

// 原型旧版本的记录和自评分来源必须完整保留。
it('兼容 v1 完整记录及缺省字段', () => {
  const progress = {
    ...createProgress(),
    completed: ['ownership'],
    currentLesson: 'borrowing',
    attempts: [
      {
        exerciseId: 'old-question',
        lessonId: 'ownership',
        answer: '解释',
        correct: true,
        selfScore: 4,
        at: '2026-10-10T12:00:00.000Z',
      },
    ],
  }
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress))
  expect(loadProgress().progress).toEqual(progress)
  expect(parseProgress({ completed: ['ownership'] })?.currentLesson).toBe(
    'ownership',
  )
})

// 无效 JSON 和类型错误不得被当作有效进度，也不得覆盖原数据。
it.each([
  '{broken',
  '{"attempts":{}}',
  '{"completed":[42]}',
  '{"streak":-1}',
  '{"weakness":{"x":"3"}}',
  'null',
])('保护损坏记录 %s', (raw) => {
  localStorage.setItem(PROGRESS_KEY, raw)
  const loaded = loadProgress()
  expect(loaded.canSave).toBe(false)
  expect(loaded.message).toContain('原数据已保留')
  expect(localStorage.getItem(PROGRESS_KEY)).toBe(raw)
})

// 安全策略拒绝访问时仍能打开页面，并提供明确的内存模式状态。
it('处理禁止访问的存储', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    // 模拟浏览器安全策略拒绝。
    throw new DOMException('Blocked', 'SecurityError')
  })
  expect(loadProgress()).toMatchObject({
    canSave: false,
    progress: createProgress(),
  })
})

// 配额耗尽不得以成功结果返回给界面。
it('报告写入失败', () => {
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    // 模拟本地存储额度耗尽。
    throw new DOMException('Full', 'QuotaExceededError')
  })
  expect(saveProgress(createProgress())).toMatchObject({ ok: false })
})
