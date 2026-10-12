import type { Exercise } from '../../types/lesson'
import type { Attempt, Progress, ProgressSummary } from './types'

/** 为每次读取创建独立空记录，避免多个页面共享可变默认数组。 */
export function createProgress(): Progress {
  return {
    completed: [],
    currentLesson: 'ownership',
    currentPositionAt: null,
    attempts: [],
    reflections: {},
    weakness: {},
    streak: 0,
    lastStudyDate: null,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  }
}

/** 按传入的账户时区生成学习日，不依赖设备时区或 locale 日期格式。 */
export function studyDate(date: Date, timeZone?: string): string {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date)
      const values = Object.fromEntries(
        parts.map((part) => [part.type, part.value]),
      )
      return `${values.year}-${values.month}-${values.day}`
    } catch {
      // 未验证的时区名不阻断本地记录，使用设备日历并由服务端校验账号时区。
    }
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** 计算连续学习天数；按日历回退可跨越夏令时的 23/25 小时日。 */
export function recordActivity(
  progress: Progress,
  now: Date = new Date(),
  timeZone = progress.timeZone,
): Pick<Progress, 'streak' | 'lastStudyDate'> {
  const today = studyDate(now, timeZone)
  if (progress.lastStudyDate === today)
    return { streak: progress.streak, lastStudyDate: today }
  const yesterday = new Date(`${today}T00:00:00.000Z`)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  return {
    streak:
      progress.lastStudyDate === studyDate(yesterday, 'UTC')
        ? progress.streak + 1
        : 1,
    lastStudyDate: today,
  }
}

/** 课程与复习统一保留同题最后一次记录，更新薄弱点和学习日，不修改输入。 */
export function recordAttempt(
  progress: Progress,
  lessonId: string,
  exercise: Exercise,
  answer: string | number,
  correct: boolean,
  selfScore?: number,
  now: Date = new Date(),
): Progress {
  const attempt: Attempt = {
    lessonId,
    exerciseId: exercise.id,
    answer,
    correct,
    selfScore,
    at: now.toISOString(),
  }
  const weakness = { ...progress.weakness }
  for (const tag of exercise.tags) {
    // 使用自有属性，避免课程标签与 Object.prototype 上的名称相撞。
    const previous = Object.hasOwn(weakness, tag) ? weakness[tag] : 0
    Object.defineProperty(weakness, tag, {
      value: Math.max(0, previous + (correct ? -1 : 1)),
      enumerable: true,
      configurable: true,
      writable: true,
    })
  }
  return {
    ...progress,
    ...recordActivity(progress, now),
    weakness,
    attempts: [
      ...progress.attempts.filter((previous) => {
        // 两个入口使用同一题目身份，复习不额外制造重复计数。
        return (
          previous.exerciseId !== exercise.id || previous.lessonId !== lessonId
        )
      }),
      attempt,
    ],
  }
}

/** 幂等标记阅读完成；这是本地自报状态，不是正式能力成绩。 */
export function markLessonComplete(
  progress: Progress,
  lessonId: string,
  now: Date = new Date(),
): Progress {
  return {
    ...progress,
    ...recordActivity(progress, now),
    currentLesson: lessonId,
    currentPositionAt: now.toISOString(),
    completed: [...new Set([...progress.completed, lessonId])],
  }
}

/** 派生本地学习概览，客观题正确率不混入查看答案后的开放题自评分。 */
export function summarizeProgress(progress: Progress): ProgressSummary {
  const objective = progress.attempts.filter((attempt) => {
    // 自评分只表示自我感觉，不能充当客观题正确数。
    return attempt.selfScore === undefined
  })
  const correct = objective.filter((attempt) => {
    // 仅在已区分证据来源的客观题集合上计数。
    return attempt.correct
  }).length
  return {
    completedCount: progress.completed.length,
    answered: progress.attempts.length,
    accuracy: objective.length
      ? Math.round((correct / objective.length) * 100)
      : null,
    weakTags: Object.entries(progress.weakness)
      .filter(([, score]) => {
        // 零分标签已经巩固，不加入复习建议。
        return score > 0
      })
      .sort((left, right) => {
        // 优先显示累计错误较多的知识点。
        return right[1] - left[1]
      })
      .slice(0, 4),
  }
}
