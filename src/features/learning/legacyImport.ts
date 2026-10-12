import legacyCourseMap from '../../../content/legacy-course-map.json'
import { readStoredValue } from '../../lib/browserStorage'
import { parseProgress, PROGRESS_KEY } from './progressStorage'
import type { Progress } from './types'

export interface LegacyCourseMapping {
  sourceId: string
  targetId: string | null
}

export type LegacyProgressPreview =
  | { status: 'empty' }
  | { status: 'unavailable'; message: string }
  | {
      status: 'available'
      progress: Progress
      mappings: LegacyCourseMapping[]
      selfRatedCount: number
    }

/** Read and validate the untouched v1 localStorage record for an explicit import preview. */
export function readLegacyProgressPreview(): LegacyProgressPreview {
  const stored = readStoredValue(PROGRESS_KEY)
  if (!stored.ok) return { status: 'unavailable', message: stored.message }
  if (stored.value === null) return { status: 'empty' }
  try {
    const value: unknown = JSON.parse(stored.value)
    const progress = parseProgress(value)
    if (!progress) {
      return {
        status: 'unavailable',
        message: '旧版记录无法识别；原始数据保持不变。',
      }
    }
    const sourceIds = new Set([
      ...progress.completed,
      ...progress.attempts.map((attempt) => attempt.lessonId),
      ...Object.keys(progress.reflections),
      progress.currentLesson,
    ])
    const mappings = [...sourceIds].map((sourceId) => ({
      sourceId,
      targetId: mapLegacyLesson(sourceId),
    }))
    return {
      status: 'available',
      progress,
      mappings,
      selfRatedCount: progress.attempts.filter(
        (attempt) => attempt.selfScore !== undefined,
      ).length,
    }
  } catch {
    return {
      status: 'unavailable',
      message: '旧版记录格式损坏；原始数据保持不变。',
    }
  }
}

/** Merge selected legacy records once by lesson/exercise identity and mark their provenance. */
export function importLegacyProgress(
  current: Progress,
  preview: LegacyProgressPreview,
): Progress {
  if (preview.status !== 'available') return current
  const mappings = new Map(
    preview.mappings.map(({ sourceId, targetId }) => [sourceId, targetId]),
  )
  const completed = preview.progress.completed.flatMap((sourceId) => {
    const targetId = mappings.get(sourceId)
    return targetId ? [targetId] : []
  })
  const attempts = new Map(
    current.attempts.map((attempt) => [
      `${attempt.lessonId}:${attempt.exerciseId}`,
      attempt,
    ]),
  )
  for (const attempt of preview.progress.attempts) {
    const targetId = mappings.get(attempt.lessonId)
    if (!targetId) continue
    const key = `${targetId}:${attempt.exerciseId}`
    if (!attempts.has(key)) {
      attempts.set(key, {
        ...attempt,
        lessonId: targetId,
        source: 'legacy_self_reported',
      })
    }
  }
  const reflections = { ...current.reflections }
  for (const [sourceId, reflection] of Object.entries(
    preview.progress.reflections,
  )) {
    const targetId = mappings.get(sourceId)
    if (targetId && !reflections[targetId]) {
      Object.defineProperty(reflections, targetId, {
        value: reflection,
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
  }
  const currentLesson = mappings.get(preview.progress.currentLesson)
  return {
    ...current,
    completed: [...new Set([...current.completed, ...completed])],
    attempts: [...attempts.values()],
    reflections,
    weakness: { ...preview.progress.weakness, ...current.weakness },
    currentLesson:
      current.currentPositionAt === null && currentLesson
        ? currentLesson
        : current.currentLesson,
  }
}

/** Return an approved canonical course ID or null when the old identifier is unknown. */
function mapLegacyLesson(sourceId: string): string | null {
  return Object.hasOwn(legacyCourseMap, sourceId)
    ? legacyCourseMap[sourceId as keyof typeof legacyCourseMap]
    : null
}
