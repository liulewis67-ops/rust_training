import { expect, it } from 'vitest'
import { lessons } from '../catalog'
import {
  createProgress,
  markLessonComplete,
  recordActivity,
  recordAttempt,
  summarizeProgress,
} from './model'

// 同题重做必须替换记录，复习不会膨胀答题数量，也不修改旧状态。
it('统一同题提交并保持不可变更新', () => {
  const initial = createProgress()
  const exercise = lessons[0].exercises[0]
  const wrong = recordAttempt(initial, lessons[0].id, exercise, 1, false)
  const retried = recordAttempt(wrong, lessons[0].id, exercise, 0, true)
  expect(initial.attempts).toHaveLength(0)
  expect(wrong.attempts[0].correct).toBe(false)
  expect(retried.attempts).toHaveLength(1)
  expect(retried.attempts[0].correct).toBe(true)
  expect(retried.weakness[exercise.tags[0]]).toBe(0)
})

// 自评通过不能提高客观题正确率，但仍保留为个人学习记录。
it('自评分与客观正确率分开', () => {
  const wrong = recordAttempt(
    createProgress(),
    'ownership',
    lessons[0].exercises[0],
    1,
    false,
  )
  const selfRated = recordAttempt(
    wrong,
    'ownership',
    lessons[0].exercises[1],
    '我的解释',
    true,
    5,
  )
  expect(summarizeProgress(selfRated)).toMatchObject({
    answered: 2,
    accuracy: 0,
  })
  expect(selfRated.attempts[1].selfScore).toBe(5)
})

// 重复完成不能重复计数；同一天的多次操作不能增加连续天数。
it('重复完成保持幂等', () => {
  const now = new Date(2026, 9, 11, 12)
  const first = markLessonComplete(createProgress(), 'ownership', now)
  const second = markLessonComplete(first, 'ownership', now)
  expect(second.completed).toEqual(['ownership'])
  expect(second.streak).toBe(1)
})

// 跨年仍以相邻日历日计算，不依赖月份或年度相同。
it('跨年连续学习不中断，间隔一天重新计算', () => {
  const progress = {
    ...createProgress(),
    streak: 3,
    lastStudyDate: '2025-12-31',
  }
  expect(recordActivity(progress, new Date(2026, 0, 1, 0, 30))).toEqual({
    streak: 4,
    lastStudyDate: '2026-01-01',
  })
  expect(recordActivity(progress, new Date(2026, 0, 2, 0, 30)).streak).toBe(1)
})

// 夏令时跳变会使“减 24 小时”落到前天，必须按本地日历回退。
it('跨夏令时仍识别昨天', () => {
  const previous = process.env.TZ
  process.env.TZ = 'America/New_York'
  try {
    const now = new Date(2026, 2, 9, 0, 30)
    expect(now.getTimezoneOffset()).toBe(240)
    expect(new Date(now.getTime() - 86400000).getDate()).toBe(7)
    expect(
      recordActivity(
        { ...createProgress(), streak: 3, lastStudyDate: '2026-03-08' },
        now,
      ).streak,
    ).toBe(4)
  } finally {
    if (previous === undefined) delete process.env.TZ
    else process.env.TZ = previous
  }
})
