import { expect, it } from 'vitest'
import { createProgress } from './model'
import type { Progress } from './types'
import {
  mergeCloudLearning,
  readCloudLearning,
  syncCloudLearning,
  type CloudLearningSnapshot,
} from './cloudLearning'

/** Supply ordered JSON responses and capture outgoing request details. */
function responseSequence(responses: Response[]) {
  const calls: Array<{ input: string; init?: RequestInit }> = []
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ input: String(input), init })
    const response = responses.shift()
    if (!response) throw new Error('Unexpected learning API request')
    return response
  }) as typeof fetch
  return { calls, fetcher }
}

/** Make a server snapshot with one activity day and the account's current zone. */
function snapshot(): CloudLearningSnapshot {
  return {
    time_zone: 'Asia/Shanghai',
    current_lesson: 'borrowing',
    current_position_at: '2026-10-12T12:00:00.000Z',
    revision: 4,
    completed: [
      { lesson_id: 'ownership', completed_at: '2026-10-11T12:00:00.000Z' },
    ],
    reflections: [
      {
        lesson_id: 'ownership',
        content: 'Server reflection',
        updated_at: '2026-10-11T12:00:00.000Z',
      },
    ],
    self_assessments: [
      {
        lesson_id: 'ownership',
        exercise_id: 'open-1',
        score: 5,
        source: 'learner_reported',
        updated_at: '2026-10-11T12:00:00.000Z',
      },
    ],
    study_days: ['2026-10-12'],
    streak: 3,
  }
}

// Account reads use server identity and load only the matching owner's state.
it('loads the server session and account-scoped learning snapshot', async () => {
  const remote = snapshot()
  const { calls, fetcher } = responseSequence([
    new Response('{"user_id":"learner-a"}', { status: 200 }),
    new Response(JSON.stringify(remote), { status: 200 }),
  ])

  await expect(readCloudLearning(fetcher)).resolves.toEqual({
    kind: 'signed-in',
    userId: 'learner-a',
    snapshot: remote,
  })
  expect(calls.map((call) => call.input)).toEqual([
    '/api/v1/auth/session',
    '/api/v1/learning/state',
  ])
})

// The wire format sends ratings, not objective answer correctness or answer text.
it('syncs self-ratings with a stable idempotency key and account session', async () => {
  const remote = snapshot()
  const progress: Progress = {
    ...createProgress(),
    currentLesson: 'borrowing',
    currentPositionAt: '2026-10-12T12:00:00.000Z',
    completed: ['ownership'],
    attempts: [
      {
        lessonId: 'ownership',
        exerciseId: 'open-1',
        answer: 'private draft answer',
        correct: true,
        selfScore: 5,
        source: 'legacy_self_reported',
        at: '2026-10-11T12:00:00.000Z',
      },
      {
        lessonId: 'ownership',
        exerciseId: 'quiz-1',
        answer: 'secret objective answer',
        correct: true,
        at: '2026-10-11T12:00:00.000Z',
      },
    ],
  }
  const { calls, fetcher } = responseSequence([
    new Response('{"user_id":"learner-a"}', { status: 200 }),
    new Response(JSON.stringify(remote), { status: 200 }),
  ])

  await expect(
    syncCloudLearning(progress, 'learner-a', 'device-1:7', fetcher),
  ).resolves.toEqual(remote)
  const request = calls[1].init
  const body = JSON.parse(String(request?.body)) as Record<string, unknown>
  expect(request?.method).toBe('POST')
  expect(body.event_id).toBe('device-1:7')
  expect(body.record_activity).toBe(true)
  expect(body.time_zone).toBe(progress.timeZone)
  expect(body.current_position_at).toBe(progress.currentPositionAt)
  expect(body).not.toHaveProperty('attempts')
  expect(body.self_assessments).toEqual([
    {
      lesson_id: 'ownership',
      exercise_id: 'open-1',
      score: 5,
      source: 'legacy_self_reported',
      updated_at: '2026-10-11T12:00:00.000Z',
    },
  ])
})

// An imported snapshot is persisted without turning an administrative action into a study day.
it('can sync an import without creating a learning activity day', async () => {
  const remote = snapshot()
  const { calls, fetcher } = responseSequence([
    new Response('{"user_id":"learner-a"}', { status: 200 }),
    new Response(JSON.stringify(remote), { status: 200 }),
  ])

  await syncCloudLearning(
    createProgress(),
    'learner-a',
    'device-import:1',
    fetcher,
    false,
  )

  const body = JSON.parse(String(calls[1].init?.body)) as Record<
    string,
    unknown
  >
  expect(body.record_activity).toBe(false)
})

// Cloud self-ratings merge without replacing objective answers or inflating quiz accuracy.
it('merges account reflections and ratings while preserving objective attempts', () => {
  const local = {
    ...createProgress(),
    attempts: [
      {
        lessonId: 'ownership',
        exerciseId: 'quiz-1',
        answer: 'A',
        correct: true,
        at: '2026-10-10T12:00:00.000Z',
      },
    ],
  }
  const merged = mergeCloudLearning(local, snapshot())
  expect(merged.timeZone).toBe('Asia/Shanghai')
  expect(merged.currentLesson).toBe('borrowing')
  expect(merged.completed).toContain('ownership')
  expect(merged.reflections.ownership.content).toBe('Server reflection')
  expect(merged.attempts).toHaveLength(2)
  expect(
    merged.attempts.find((item) => item.exerciseId === 'quiz-1'),
  ).toMatchObject({
    answer: 'A',
    correct: true,
  })
  expect(
    merged.attempts.find((item) => item.exerciseId === 'open-1'),
  ).toMatchObject({
    selfScore: 5,
    correct: false,
  })
})
