import type { Progress } from './types'

export interface CloudLearningSnapshot {
  time_zone: string
  current_lesson: string
  current_position_at: string
  revision: number
  completed: Array<{ lesson_id: string; completed_at: string }>
  reflections: Array<{
    lesson_id: string
    content: string
    updated_at: string
  }>
  self_assessments: Array<{
    lesson_id: string
    exercise_id: string
    score: number
    updated_at: string
  }>
  study_days: string[]
  streak: number
}

export type CloudLearningSession =
  | { kind: 'signed-out' }
  | {
      kind: 'signed-in'
      userId: string
      snapshot: CloudLearningSnapshot | null
    }

export class CloudLearningError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message)
    this.name = 'CloudLearningError'
  }
}

/** Load the authenticated account's learning state without exposing other owners' records. */
export async function readCloudLearning(
  fetcher: typeof fetch = fetch,
  expectedUserId?: string | null,
): Promise<CloudLearningSession> {
  const userId = await readLearningOwner(fetcher)
  if (expectedUserId !== undefined && userId !== expectedUserId) {
    throw new CloudLearningError('The signed-in account changed', 401)
  }
  if (userId === null) return { kind: 'signed-out' }
  const response = await fetcher('/api/v1/learning/state', {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: requestTimeout(),
  })
  if (response.status === 404) {
    return { kind: 'signed-in', userId, snapshot: null }
  }
  if (!response.ok) throw await responseError(response)
  return {
    kind: 'signed-in',
    userId,
    snapshot: parseSnapshot(await readJson(response)),
  }
}

/** Send a full local snapshot using an idempotency key and verify the session owner first. */
export async function syncCloudLearning(
  progress: Progress,
  userId: string,
  eventId: string,
  fetcher: typeof fetch = fetch,
): Promise<CloudLearningSnapshot> {
  await requireSameOwner(fetcher, userId)
  const reflections = Object.entries(progress.reflections).map(
    ([lesson_id, reflection]) => ({
      lesson_id,
      content: reflection.content,
      updated_at: reflection.updatedAt,
    }),
  )
  const self_assessments = progress.attempts.flatMap((attempt) =>
    attempt.selfScore === undefined
      ? []
      : [
          {
            lesson_id: attempt.lessonId,
            exercise_id: attempt.exerciseId,
            score: attempt.selfScore,
            updated_at: attempt.at,
          },
        ],
  )
  const response = await fetcher('/api/v1/learning/sync', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      event_id: eventId,
      occurred_at: new Date().toISOString(),
      current_position_at:
        progress.currentPositionAt ?? new Date().toISOString(),
      time_zone: progress.timeZone,
      current_lesson: progress.currentLesson,
      completed: progress.completed,
      reflections,
      self_assessments,
    }),
    signal: requestTimeout(),
  })
  if (!response.ok) throw await responseError(response)
  return parseSnapshot(await readJson(response))
}

/** Change the account's authoritative IANA time zone after verifying its identity. */
export async function changeCloudTimeZone(
  userId: string,
  timeZone: string,
  fetcher: typeof fetch = fetch,
): Promise<CloudLearningSnapshot> {
  await requireSameOwner(fetcher, userId)
  const response = await fetcher('/api/v1/learning/time-zone', {
    method: 'PUT',
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ time_zone: timeZone }),
    signal: requestTimeout(),
  })
  if (!response.ok) throw await responseError(response)
  return parseSnapshot(await readJson(response))
}

/** Merge account state into a device snapshot without promoting self-ratings to quiz results. */
export function mergeCloudLearning(
  local: Progress,
  remote: CloudLearningSnapshot,
): Progress {
  const attempts = new Map(
    local.attempts.map((attempt) => [
      `${attempt.lessonId}:${attempt.exerciseId}`,
      attempt,
    ]),
  )
  for (const assessment of remote.self_assessments) {
    const key = `${assessment.lesson_id}:${assessment.exercise_id}`
    const previous = attempts.get(key)
    if (
      !previous ||
      (previous.selfScore !== undefined &&
        Date.parse(assessment.updated_at) > Date.parse(previous.at))
    ) {
      attempts.set(key, {
        lessonId: assessment.lesson_id,
        exerciseId: assessment.exercise_id,
        answer: '',
        correct: false,
        selfScore: assessment.score,
        at: assessment.updated_at,
      })
    }
  }
  const reflections = { ...local.reflections }
  for (const reflection of remote.reflections) {
    const previous = reflections[reflection.lesson_id]
    if (
      !previous ||
      Date.parse(reflection.updated_at) > Date.parse(previous.updatedAt)
    ) {
      Object.defineProperty(reflections, reflection.lesson_id, {
        value: {
          content: reflection.content,
          updatedAt: reflection.updated_at,
        },
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
  }
  const remotePositionIsNewer =
    !local.currentPositionAt ||
    Date.parse(remote.current_position_at) >=
      Date.parse(local.currentPositionAt)
  return {
    ...local,
    timeZone: remote.time_zone,
    currentLesson: remotePositionIsNewer
      ? remote.current_lesson
      : local.currentLesson,
    currentPositionAt: remotePositionIsNewer
      ? remote.current_position_at
      : local.currentPositionAt,
    completed: [
      ...new Set([
        ...local.completed,
        ...remote.completed.map((item) => item.lesson_id),
      ]),
    ],
    reflections,
    attempts: [...attempts.values()],
    streak: remote.streak,
    lastStudyDate: remote.study_days[0] ?? null,
  }
}

/** Read and validate the current server-provided user ID before private state operations. */
export async function readLearningOwner(
  fetcher: typeof fetch = fetch,
): Promise<string | null> {
  const response = await fetcher('/api/v1/auth/session', {
    credentials: 'same-origin',
    cache: 'no-store',
    signal: requestTimeout(),
  })
  if (response.status === 401) return null
  if (!response.ok) throw await responseError(response)
  const body = await readJson(response)
  if (!isRecord(body) || typeof body.user_id !== 'string' || !body.user_id) {
    throw new CloudLearningError(
      'The session response did not include an owner',
    )
  }
  return body.user_id
}

/** Refuse a write if this tab now carries another account's session cookie. */
async function requireSameOwner(
  fetcher: typeof fetch,
  expectedUserId: string,
): Promise<void> {
  const actualUserId = await readLearningOwner(fetcher)
  if (actualUserId !== expectedUserId) {
    throw new CloudLearningError('The signed-in account changed', 401)
  }
}

/** Bound API requests so an unavailable service cannot leave cloud status pending forever. */
function requestTimeout(): AbortSignal {
  return AbortSignal.timeout(5000)
}

/** Parse response JSON or return a stable, non-sensitive API error. */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new CloudLearningError(
      'The learning API returned invalid JSON',
      response.status,
    )
  }
}

/** Convert malformed state payloads into one safe client error. */
function parseSnapshot(value: unknown): CloudLearningSnapshot {
  if (
    !isRecord(value) ||
    !isIdentifier(value.time_zone) ||
    !isIdentifier(value.current_lesson) ||
    typeof value.current_position_at !== 'string' ||
    typeof value.revision !== 'number' ||
    !Number.isInteger(value.revision) ||
    value.revision < 1 ||
    !Array.isArray(value.completed) ||
    !Array.isArray(value.reflections) ||
    !Array.isArray(value.self_assessments) ||
    !Array.isArray(value.study_days) ||
    typeof value.streak !== 'number' ||
    !Number.isInteger(value.streak) ||
    value.streak < 0 ||
    !isTimestamp(value.current_position_at)
  ) {
    throw new CloudLearningError('The learning API returned invalid state')
  }
  if (
    !value.completed.every(
      (item) =>
        isRecord(item) &&
        isIdentifier(item.lesson_id) &&
        isTimestamp(item.completed_at),
    ) ||
    !value.reflections.every(
      (item) =>
        isRecord(item) &&
        isIdentifier(item.lesson_id) &&
        typeof item.content === 'string' &&
        item.content.length <= 16 * 1024 &&
        isTimestamp(item.updated_at),
    ) ||
    !value.self_assessments.every(
      (item) =>
        isRecord(item) &&
        isIdentifier(item.lesson_id) &&
        isIdentifier(item.exercise_id) &&
        typeof item.score === 'number' &&
        Number.isInteger(item.score) &&
        item.score >= 1 &&
        item.score <= 5 &&
        isTimestamp(item.updated_at),
    ) ||
    !value.study_days.every(
      (day) => typeof day === 'string' && isCalendarDate(day),
    )
  ) {
    throw new CloudLearningError(
      'The learning API returned invalid learning records',
    )
  }
  const completed = value.completed.map((item) => ({
    lesson_id: (item as Record<string, unknown>).lesson_id as string,
    completed_at: (item as Record<string, unknown>).completed_at as string,
  }))
  const reflections = value.reflections.map((item) => ({
    lesson_id: (item as Record<string, unknown>).lesson_id as string,
    content: (item as Record<string, unknown>).content as string,
    updated_at: (item as Record<string, unknown>).updated_at as string,
  }))
  const self_assessments = value.self_assessments.map((item) => ({
    lesson_id: (item as Record<string, unknown>).lesson_id as string,
    exercise_id: (item as Record<string, unknown>).exercise_id as string,
    score: (item as Record<string, unknown>).score as number,
    updated_at: (item as Record<string, unknown>).updated_at as string,
  }))
  return {
    time_zone: value.time_zone,
    current_lesson: value.current_lesson,
    current_position_at: value.current_position_at,
    revision: value.revision as number,
    completed,
    reflections,
    self_assessments,
    study_days: value.study_days,
    streak: value.streak as number,
  }
}

/** Check unknown JSON values before reading untrusted API fields. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Check API identifiers against the server's UTF-8 byte length and non-empty rules. */
function isIdentifier(value: unknown): value is string {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= 128
  )
}

/** Require a parseable absolute instant for persisted merge order. */
function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

/** Validate calendar date shape and reject impossible dates. */
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  )
}

/** Return a safe, generic HTTP error if the server's message is absent or malformed. */
async function responseError(response: Response): Promise<CloudLearningError> {
  try {
    const body = await readJson(response)
    if (isRecord(body) && typeof body.message === 'string') {
      return new CloudLearningError(body.message, response.status)
    }
  } catch {
    // Preserve the generic message for non-JSON gateway failures.
  }
  return new CloudLearningError(
    'Cloud learning progress is unavailable',
    response.status,
  )
}
