import { afterEach, expect, it, vi } from 'vitest'
import { createProgress } from './model'
import { browserStorageKey } from '../../lib/browserStorage'
import {
  loadProgress,
  parseProgress,
  progressStorageKey,
  saveProgress,
} from './progressStorage'

// 每个场景单独使用本地存储，清理错误模拟。
afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
})

// Each static Pages deployment has a separate browser progress namespace.
it('scopes local progress to the deployed app path', () => {
  expect(progressStorageKey()).toBe(browserStorageKey('learning:v3'))
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
  localStorage.setItem(progressStorageKey(), JSON.stringify(progress))
  expect(loadProgress(progressStorageKey()).progress).toMatchObject(progress)
  expect(loadProgress(progressStorageKey()).progress.attempts[0].source).toBe(
    'learner_reported',
  )
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
  localStorage.setItem(progressStorageKey(), raw)
  const loaded = loadProgress(progressStorageKey())
  expect(loaded.canSave).toBe(false)
  expect(loaded.message).toContain('原数据已保留')
  expect(localStorage.getItem(progressStorageKey())).toBe(raw)
})

// 安全策略拒绝访问时仍能打开页面，并提供明确的内存模式状态。
it('处理禁止访问的存储', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    // 模拟浏览器安全策略拒绝。
    throw new DOMException('Blocked', 'SecurityError')
  })
  expect(loadProgress(progressStorageKey())).toMatchObject({
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
