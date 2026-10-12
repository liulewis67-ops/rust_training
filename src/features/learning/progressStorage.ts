import {
  readStoredValue,
  writeStoredValue,
  type StorageResult,
} from '../../lib/browserStorage'
import { createProgress } from './model'
import type { Attempt, Progress } from './types'

export const PROGRESS_KEY = 'rust-backend-training:v1'

/** Scope authenticated local snapshots to one server identity; keep v1 as the anonymous legacy key. */
export function progressStorageKey(ownerId?: string): string {
  return ownerId
    ? `${PROGRESS_KEY}:account:${encodeURIComponent(ownerId)}`
    : PROGRESS_KEY
}
export interface LoadedProgress {
  progress: Progress
  message: string
  canSave: boolean
}

/** 判断外部 JSON 是否为普通记录，后续读取仍需逐字段验证。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** 验证历史答题记录，包括可选自评范围及可解析时间。 */
function isAttempt(value: unknown): value is Attempt {
  if (!isRecord(value)) return false
  return (
    typeof value.exerciseId === 'string' &&
    typeof value.lessonId === 'string' &&
    typeof value.correct === 'boolean' &&
    (typeof value.answer === 'string' ||
      (typeof value.answer === 'number' && Number.isFinite(value.answer))) &&
    typeof value.at === 'string' &&
    Number.isFinite(Date.parse(value.at)) &&
    (value.selfScore === undefined ||
      (typeof value.selfScore === 'number' &&
        Number.isInteger(value.selfScore) &&
        value.selfScore >= 1 &&
        value.selfScore <= 5))
  )
}

/** 校验旧版 v1 记录，允许早期版本省略字段；结构损坏时拒绝整体覆盖。 */
export function parseProgress(value: unknown): Progress | null {
  if (!isRecord(value)) return null
  const initial = createProgress()
  const completed = value.completed ?? initial.completed
  const attempts = value.attempts ?? initial.attempts
  const weakness = value.weakness ?? initial.weakness
  const currentLesson = value.currentLesson ?? initial.currentLesson
  const currentPositionAt = value.currentPositionAt ?? null
  const reflections = value.reflections ?? initial.reflections
  const streak = value.streak ?? initial.streak
  const lastStudyDate = value.lastStudyDate ?? null
  const timeZone = value.timeZone ?? initial.timeZone
  if (
    !Array.isArray(completed) ||
    !completed.every((id) => {
      // v1 用字符串课程 ID 保存阅读状态，保留历史映射需要的原 ID。
      return typeof id === 'string'
    })
  )
    return null
  if (
    !Array.isArray(attempts) ||
    !attempts.every(isAttempt) ||
    !isRecord(weakness)
  )
    return null
  const validWeakness: Record<string, number> = {}
  for (const [tag, score] of Object.entries(weakness)) {
    if (typeof score !== 'number' || !Number.isFinite(score) || score < 0)
      return null
    Object.defineProperty(validWeakness, tag, {
      value: score,
      enumerable: true,
    })
  }
  if (
    typeof currentLesson !== 'string' ||
    (currentPositionAt !== null &&
      (typeof currentPositionAt !== 'string' ||
        !Number.isFinite(Date.parse(currentPositionAt)))) ||
    typeof timeZone !== 'string' ||
    timeZone.length === 0 ||
    typeof streak !== 'number' ||
    !Number.isInteger(streak) ||
    streak < 0
  )
    return null
  if (!isRecord(reflections)) return null
  const validReflections: Progress['reflections'] = {}
  for (const [lessonId, reflection] of Object.entries(reflections)) {
    if (
      !lessonId ||
      !isRecord(reflection) ||
      typeof reflection.content !== 'string' ||
      reflection.content.length > 16 * 1024 ||
      typeof reflection.updatedAt !== 'string' ||
      !Number.isFinite(Date.parse(reflection.updatedAt))
    ) {
      return null
    }
    Object.defineProperty(validReflections, lessonId, {
      value: {
        content: reflection.content,
        updatedAt: reflection.updatedAt,
      },
      enumerable: true,
    })
  }
  if (
    lastStudyDate !== null &&
    (typeof lastStudyDate !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(lastStudyDate))
  )
    return null
  return {
    completed: [...new Set(completed)],
    attempts,
    currentPositionAt,
    weakness: validWeakness,
    reflections: validReflections,
    timeZone,
    currentLesson,
    streak,
    lastStudyDate,
  }
}

/** 加载兼容的原型记录；损坏原文保持在原键中，当前会话禁止自动覆盖。 */
export function loadProgress(key = PROGRESS_KEY): LoadedProgress {
  const stored = readStoredValue(key)
  if (!stored.ok)
    return {
      progress: createProgress(),
      message: stored.message,
      canSave: false,
    }
  if (stored.value === null)
    return {
      progress: createProgress(),
      message: '本地练习 · 尚无学习记录',
      canSave: true,
    }
  try {
    const parsed: unknown = JSON.parse(stored.value)
    const progress = parseProgress(parsed)
    if (progress) return { progress, message: '本地进度已恢复', canSave: true }
  } catch {
    // 解析失败与结构错误采用相同保护方式，不把空记录写回损坏原文。
  }
  return {
    progress: createProgress(),
    message: '本地记录损坏，原数据已保留；本次进度仅在内存中保留',
    canSave: false,
  }
}

/** 以原 v1 键保存已验证的本地记录，不引入云同步或成绩升级。 */
export function saveProgress(
  progress: Progress,
  key = PROGRESS_KEY,
): StorageResult<void> {
  return writeStoredValue(key, JSON.stringify(progress))
}
