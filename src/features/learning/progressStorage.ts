import {
  browserStorageKey,
  readStoredValue,
  writeStoredValue,
  type StorageResult,
} from '../../lib/browserStorage'
import { createProgress } from './model'
import type { Attempt, Progress } from './types'

export const PROGRESS_KEY = 'rust-backend-training:v1'
const LEGACY_ANONYMOUS_KEY = 'rust-backend-training:learning:v2:anonymous'
const STORAGE_SCHEMA_VERSION = 3

/** Scope records by the Pages path so sibling repositories on github.io stay separate. */
export function progressStorageKey(): string {
  return browserStorageKey('learning:v3')
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
    value.exerciseId.length <= 200 &&
    typeof value.lessonId === 'string' &&
    value.lessonId.length <= 200 &&
    typeof value.correct === 'boolean' &&
    ((typeof value.answer === 'string' && value.answer.length <= 8000) ||
      (typeof value.answer === 'number' && Number.isFinite(value.answer))) &&
    typeof value.at === 'string' &&
    Number.isFinite(Date.parse(value.at)) &&
    (value.source === undefined ||
      value.source === 'learner_reported' ||
      value.source === 'legacy_self_reported') &&
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
    completed.length > 2000 ||
    !completed.every((id) => {
      // v1 用字符串课程 ID 保存阅读状态，保留历史映射需要的原 ID。
      return typeof id === 'string'
    })
  )
    return null
  if (
    !Array.isArray(attempts) ||
    attempts.length > 2000 ||
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
    attempts: attempts.map((attempt) => ({
      ...attempt,
      source: attempt.source ?? 'learner_reported',
    })),
    currentPositionAt,
    weakness: validWeakness,
    reflections: validReflections,
    timeZone,
    currentLesson,
    streak,
    lastStudyDate,
  }
}

/** Read the current record or safely migrate an older anonymous snapshot in memory. */
export function loadProgress(key = progressStorageKey()): LoadedProgress {
  const stored = readStoredValue(key)
  if (!stored.ok)
    return {
      progress: createProgress(),
      message: stored.message,
      canSave: false,
    }
  if (stored.value === null) {
    // Old keys were not path-scoped; migrate them only at a root deployment.
    const canReadLegacyKeys = import.meta.env.BASE_URL === '/'
    if (!canReadLegacyKeys)
      return {
        progress: createProgress(),
        message: '本地练习 · 尚无学习记录',
        canSave: true,
      }
    const legacy = readStoredValue(LEGACY_ANONYMOUS_KEY)
    if (!legacy.ok)
      return {
        progress: createProgress(),
        message: '本地存储不可用，本次进度仅在内存中保留',
        canSave: false,
      }
    if (legacy.value !== null) return parseStoredProgress(legacy.value, true)
    const original = readStoredValue(PROGRESS_KEY)
    if (!original.ok)
      return {
        progress: createProgress(),
        message: '本地存储不可用，本次进度仅在内存中保留',
        canSave: false,
      }
    if (original.value !== null)
      return parseStoredProgress(original.value, true)
    return {
      progress: createProgress(),
      message: '本地练习 · 尚无学习记录',
      canSave: true,
    }
  }
  return parseStoredProgress(stored.value, false)
}

/** Parse both current versioned records and compatible anonymous legacy records. */
function parseStoredProgress(raw: string, isLegacy: boolean): LoadedProgress {
  try {
    const parsed: unknown = JSON.parse(raw)
    const candidate =
      typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    const progress =
      candidate?.schemaVersion === STORAGE_SCHEMA_VERSION
        ? parseProgress(candidate.progress)
        : candidate?.schemaVersion === undefined
          ? parseProgress(parsed)
          : null
    if (progress)
      return {
        progress,
        message: isLegacy ? '旧版本地进度已读取' : '本地进度已恢复',
        canSave: true,
      }
  } catch {
    // Leave an unreadable record intact so the learner can recover it manually.
  }
  return {
    progress: createProgress(),
    message: '本地记录无法识别，原数据已保留；本次进度仅在内存中保留',
    canSave: false,
  }
}

/** Save only the bounded, versioned snapshot used by this Pages deployment. */
export function saveProgress(
  progress: Progress,
  key = progressStorageKey(),
): StorageResult<void> {
  const boundedProgress = {
    ...progress,
    attempts: progress.attempts.slice(-200),
    reflections: Object.fromEntries(
      Object.entries(progress.reflections)
        .slice(-50)
        .map(([lessonId, reflection]) => [
          lessonId,
          { ...reflection, content: reflection.content.slice(0, 4000) },
        ]),
    ),
  }
  return writeStoredValue(
    key,
    JSON.stringify({
      schemaVersion: STORAGE_SCHEMA_VERSION,
      progress: boundedProgress,
    }),
  )
}

/** Remove only this app's new and known anonymous legacy keys. */
export function clearStoredProgress(): StorageResult<void> {
  try {
    window.localStorage.removeItem(progressStorageKey())
    if (import.meta.env.BASE_URL === '/') {
      window.localStorage.removeItem(LEGACY_ANONYMOUS_KEY)
      window.localStorage.removeItem(PROGRESS_KEY)
    }
    return { ok: true, value: undefined }
  } catch {
    return { ok: false, message: '浏览器存储不可用' }
  }
}
