import { afterEach, expect, it } from 'vitest'
import { createProgress, summarizeProgress } from './model'
import { importLegacyProgress, readLegacyProgressPreview } from './legacyImport'
import { LEARNING_STORAGE_KEY, PROGRESS_KEY } from './progressStorage'

/** Build one old local record with a known course, an unknown course, and a score. */
function legacyRecord() {
  return {
    completed: ['ownership', 'removed-course'],
    currentLesson: 'ownership',
    attempts: [
      {
        lessonId: 'ownership',
        exerciseId: 'old-open-question',
        answer: 'I knew it before',
        correct: true,
        selfScore: 5,
        at: '2024-04-05T10:00:00.000Z',
      },
    ],
  }
}

/** Clear old and target records between import scenarios. */
afterEach(() => {
  localStorage.clear()
})

// Preview maps known IDs and explains that unknown records stay in the source backup.
it('previews known and unknown old course IDs without changing their source', () => {
  const raw = JSON.stringify(legacyRecord())
  localStorage.setItem(PROGRESS_KEY, raw)

  const preview = readLegacyProgressPreview()

  expect(preview.status).toBe('available')
  if (preview.status !== 'available') return
  expect(preview.selfRatedCount).toBe(1)
  expect(preview.mappings).toContainEqual({
    sourceId: 'ownership',
    targetId: 'ownership',
  })
  expect(preview.mappings).toContainEqual({
    sourceId: 'removed-course',
    targetId: null,
  })
  expect(localStorage.getItem(PROGRESS_KEY)).toBe(raw)
})

// Import keeps a legacy score explicitly self-reported and never counts it as objective accuracy.
it('imports mapped learning as legacy evidence and leaves unknown IDs out of current progress', () => {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(legacyRecord()))
  const preview = readLegacyProgressPreview()
  const imported = importLegacyProgress(createProgress(), preview)

  expect(imported.completed).toEqual(['ownership'])
  expect(imported.attempts[0]).toMatchObject({
    lessonId: 'ownership',
    selfScore: 5,
    source: 'legacy_self_reported',
  })
  expect(summarizeProgress(imported).accuracy).toBeNull()
  expect(imported.completed).not.toContain('removed-course')
})

// Repeated imports merge by course/exercise identity instead of duplicating answers.
it('is idempotent when the same legacy preview is imported more than once', () => {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(legacyRecord()))
  const preview = readLegacyProgressPreview()
  const first = importLegacyProgress(createProgress(), preview)
  const second = importLegacyProgress(first, preview)

  expect(second.completed).toEqual(['ownership'])
  expect(second.attempts).toHaveLength(1)
  expect(second.attempts[0].source).toBe('legacy_self_reported')
})

// Signed-in and anonymous snapshots use v2 keys, keeping the legacy source intact until consent.
it('does not reuse the v1 source as the active progress key', () => {
  expect(LEARNING_STORAGE_KEY).not.toBe(PROGRESS_KEY)
})
