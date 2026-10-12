import { useCallback, useEffect, useState } from 'react'
import type { Exercise } from '../../types/lesson'
import {
  changeCloudTimeZone,
  mergeCloudLearning,
  readCloudLearning,
  readLearningOwner,
  syncCloudLearning,
} from './cloudLearning'
import {
  createProgress,
  markLessonComplete,
  recordActivity,
  recordAttempt,
} from './model'
import {
  loadProgress,
  progressStorageKey,
  saveProgress,
} from './progressStorage'
import {
  importLegacyProgress,
  readLegacyProgressPreview,
  type LegacyProgressPreview,
} from './legacyImport'
import type { Progress } from './types'

interface LearningState {
  progress: Progress
  saveStatus: string
  rememberLesson: (id: string) => void
  completeLesson: (id: string) => void
  saveReflection: (lessonId: string, content: string) => void
  setTimeZone: (timeZone: string) => void
  retrySync: () => void
  legacyPreview: LegacyProgressPreview
  importLegacy: () => void
  syncStatus: CloudSyncStatus
  submitAttempt: (
    lessonId: string,
    exercise: Exercise,
    answer: string | number,
    correct: boolean,
    score?: number,
  ) => void
}

type CloudSyncStatus =
  | 'checking'
  | 'signed-out'
  | 'ready'
  | 'dirty'
  | 'saving'
  | 'error'

interface VersionedProgress {
  progress: Progress
  revision: number
  eventId: string
  recordActivity: boolean
}

/** Manage local learning state and idempotently synchronize account-owned study records. */
export function useProgress(): LearningState {
  const [deviceId] = useState(createEventId)
  const [state, setState] = useState<VersionedProgress>(() => ({
    progress: createProgress(),
    revision: 0,
    eventId: `${deviceId}:0`,
    recordActivity: false,
  }))
  const [localSaveStatus, setLocalSaveStatus] = useState('正在读取本地进度…')
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>('checking')
  const [ownerId, setOwnerId] = useState<string>()
  const [storageKey, setStorageKey] = useState<string>()
  const [canSaveLocal, setCanSaveLocal] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [cloudInitialized, setCloudInitialized] = useState(false)
  const [retryToken, setRetryToken] = useState(0)
  const [legacyPreview] = useState(readLegacyProgressPreview)

  useEffect(() => {
    let current = true
    let loadGeneration = 0
    /** Resolve identity before reading storage so another account's data is never rendered. */
    async function loadAccountLearning(): Promise<void> {
      const generation = ++loadGeneration
      const isCurrent = (): boolean => current && generation === loadGeneration
      let resolvedOwner: string | null = null
      let sessionAvailable = true
      try {
        resolvedOwner = await readLearningOwner()
      } catch {
        sessionAvailable = false
      }
      if (!isCurrent()) return
      const key = progressStorageKey(
        sessionAvailable ? (resolvedOwner ?? undefined) : 'offline',
      )
      const loaded = loadProgress(key)
      setStorageKey(key)
      setCanSaveLocal(loaded.canSave)
      setLocalSaveStatus(loaded.message)
      setOwnerId(resolvedOwner ?? undefined)
      setState((latest) => {
        const revision = latest.revision + 1
        return {
          progress:
            latest.revision === 0
              ? loaded.progress
              : mergeLocalProgress(loaded.progress, latest.progress),
          revision,
          eventId: `${deviceId}:${revision}`,
          recordActivity: false,
        }
      })
      setIsLoaded(true)
      if (!sessionAvailable) {
        setSyncStatus('error')
        return
      }
      try {
        const session = await readCloudLearning(fetch, resolvedOwner)
        if (!isCurrent()) return
        if (session.kind === 'signed-out') {
          setSyncStatus('signed-out')
          setCloudInitialized(true)
          return
        }
        setState((latest) => ({
          progress: session.snapshot
            ? mergeCloudLearning(latest.progress, session.snapshot)
            : latest.progress,
          revision: latest.revision + 1,
          eventId: `${deviceId}:${latest.revision + 1}`,
          recordActivity: false,
        }))
        setSyncStatus('ready')
        setCloudInitialized(true)
      } catch {
        if (isCurrent()) {
          setSyncStatus('error')
          setCloudInitialized(true)
        }
      }
    }
    void loadAccountLearning()
    /** A successful logout clears visible private state before anonymous storage loads. */
    function handleSessionChange(): void {
      loadGeneration += 1
      setState({
        progress: createProgress(),
        revision: 0,
        eventId: `${deviceId}:0`,
        recordActivity: false,
      })
      setOwnerId(undefined)
      setStorageKey(undefined)
      setCanSaveLocal(false)
      setIsLoaded(false)
      setCloudInitialized(false)
      setSyncStatus('checking')
      void loadAccountLearning()
    }
    window.addEventListener('rust-path-session-changed', handleSessionChange)
    return () => {
      // Ignore a delayed response if the application root unmounts.
      current = false
      window.removeEventListener(
        'rust-path-session-changed',
        handleSessionChange,
      )
    }
  }, [deviceId])

  useEffect(() => {
    // Invalid stored JSON remains untouched so this update cannot erase recoverable data.
    if (!isLoaded || !storageKey || !canSaveLocal) return
    const result = saveProgress(state.progress, storageKey)
    setLocalSaveStatus(result.ok ? '本地进度已保存' : result.message)
  }, [state, isLoaded, storageKey, canSaveLocal])

  useEffect(() => {
    if (!ownerId || !isLoaded || !cloudInitialized || state.revision === 0)
      return
    const userId = ownerId
    let current = true
    setSyncStatus('saving')
    /** Push one snapshot with a stable event ID so a retried HTTP request is idempotent. */
    async function synchronize(): Promise<void> {
      try {
        const remote = await syncCloudLearning(
          state.progress,
          userId,
          state.eventId,
          fetch,
          state.recordActivity,
        )
        if (!current) return
        setState((latest) => {
          const merged = mergeCloudLearning(latest.progress, remote)
          if (JSON.stringify(merged) === JSON.stringify(latest.progress)) {
            return latest
          }
          return {
            progress: merged,
            revision: latest.revision + 1,
            eventId: `${deviceId}:${latest.revision + 1}`,
            recordActivity: false,
          }
        })
        setSyncStatus('ready')
      } catch {
        if (current) setSyncStatus('error')
      }
    }
    void synchronize()
    return () => {
      // Ignore an old sync response when a newer local revision has replaced it.
      current = false
    }
  }, [cloudInitialized, deviceId, isLoaded, ownerId, retryToken, state])

  /** Record the latest route and learning day using the account's calendar zone. */
  const rememberLesson = useCallback(
    (id: string): void => {
      setState((current) => {
        if (current.progress.currentLesson === id) return current
        const now = new Date()
        return nextVersion(current, {
          ...current.progress,
          ...recordActivity(current.progress, now),
          currentLesson: id,
          currentPositionAt: now.toISOString(),
        })
      })
      setSyncStatus((status) => (ownerId ? 'dirty' : status))
    },
    [ownerId],
  )

  /** Record course completion as learner-reported progress, separate from assessment scores. */
  function completeLesson(id: string): void {
    setState((current) =>
      nextVersion(current, markLessonComplete(current.progress, id)),
    )
    setSyncStatus((status) => (ownerId ? 'dirty' : status))
  }

  /** Save a learner's reflection text as a separate account-owned study record. */
  function saveReflection(lessonId: string, content: string): void {
    const now = new Date().toISOString()
    setState((current) =>
      nextVersion(current, {
        ...current.progress,
        ...recordActivity(current.progress, new Date(now)),
        reflections: {
          ...current.progress.reflections,
          [lessonId]: { content, updatedAt: now },
        },
      }),
    )
    setSyncStatus((status) => (ownerId ? 'dirty' : status))
  }

  /** Persist a valid account time zone and apply it to subsequent learning-day calculations. */
  async function setTimeZone(timeZone: string): Promise<void> {
    try {
      new Intl.DateTimeFormat('en', { timeZone })
    } catch {
      setLocalSaveStatus('请输入有效的 IANA 时区，例如 Asia/Shanghai')
      return
    }
    if (!ownerId) {
      setState((current) =>
        nextVersion(current, { ...current.progress, timeZone }, false),
      )
      setLocalSaveStatus('时区仅保存在本机；登录后可保存到账户')
      return
    }
    setSyncStatus('saving')
    try {
      const remote = await changeCloudTimeZone(ownerId, timeZone)
      setState((current) =>
        nextVersion(
          current,
          mergeCloudLearning(current.progress, remote),
          false,
        ),
      )
      setSyncStatus('ready')
    } catch {
      setSyncStatus('error')
    }
  }

  /** Retry the latest sync with the same idempotency key after a temporary server failure. */
  function retrySync(): void {
    if (!ownerId || syncStatus !== 'error') return
    setRetryToken((token) => token + 1)
  }

  /** Import the reviewed v1 snapshot once by lesson and exercise identity. */
  function importLegacy(): void {
    if (legacyPreview.status !== 'available') return
    setState((current) =>
      nextVersion(
        current,
        importLegacyProgress(current.progress, legacyPreview),
        false,
      ),
    )
    setSyncStatus((status) => (ownerId ? 'dirty' : status))
    setLocalSaveStatus('旧版记录已导入；原始 v1 数据仍保留')
  }

  /** Save quiz attempts locally; only self-scored records are selected by the cloud adapter. */
  function submitAttempt(
    lessonId: string,
    exercise: Exercise,
    answer: string | number,
    correct: boolean,
    score?: number,
  ): void {
    setState((current) =>
      nextVersion(
        current,
        recordAttempt(
          current.progress,
          lessonId,
          exercise,
          answer,
          correct,
          score,
        ),
      ),
    )
    setSyncStatus((status) => (ownerId ? 'dirty' : status))
  }

  const syncMessage = {
    checking: '正在读取账户学习记录…',
    'signed-out': '本地进度已保存；登录后可跨设备同步',
    ready: '账户学习记录已同步',
    dirty: '本地进度已保存；等待云端同步',
    saving: '正在同步账户学习记录…',
    error: '云端同步失败；本地学习记录仍保留',
  }[syncStatus]
  return {
    progress: state.progress,
    saveStatus:
      !canSaveLocal || !isLoaded || localSaveStatus.includes('失败')
        ? localSaveStatus
        : syncMessage,
    rememberLesson,
    completeLesson,
    saveReflection,
    setTimeZone,
    retrySync,
    legacyPreview,
    importLegacy,
    syncStatus,
    submitAttempt,
  }
}

/** Preserve user input made while identity and its storage namespace are resolving. */
function mergeLocalProgress(stored: Progress, current: Progress): Progress {
  const attempts = new Map(
    stored.attempts.map((attempt) => [
      `${attempt.lessonId}:${attempt.exerciseId}`,
      attempt,
    ]),
  )
  for (const attempt of current.attempts) {
    const key = `${attempt.lessonId}:${attempt.exerciseId}`
    const existing = attempts.get(key)
    if (!existing || Date.parse(attempt.at) >= Date.parse(existing.at)) {
      attempts.set(key, attempt)
    }
  }
  const reflections = { ...stored.reflections }
  for (const [lessonId, reflection] of Object.entries(current.reflections)) {
    const existing = reflections[lessonId]
    if (
      !existing ||
      Date.parse(reflection.updatedAt) >= Date.parse(existing.updatedAt)
    ) {
      Object.defineProperty(reflections, lessonId, {
        value: reflection,
        enumerable: true,
        configurable: true,
        writable: true,
      })
    }
  }
  const currentPositionIsNewer =
    current.currentPositionAt !== null &&
    (stored.currentPositionAt === null ||
      Date.parse(current.currentPositionAt) >=
        Date.parse(stored.currentPositionAt))
  return {
    ...stored,
    ...current,
    currentLesson: currentPositionIsNewer
      ? current.currentLesson
      : stored.currentLesson,
    currentPositionAt: currentPositionIsNewer
      ? current.currentPositionAt
      : stored.currentPositionAt,
    completed: [...new Set([...stored.completed, ...current.completed])],
    attempts: [...attempts.values()],
    reflections,
    weakness: { ...stored.weakness, ...current.weakness },
    streak: Math.max(stored.streak, current.streak),
    lastStudyDate:
      current.lastStudyDate &&
      (!stored.lastStudyDate || current.lastStudyDate > stored.lastStudyDate)
        ? current.lastStudyDate
        : stored.lastStudyDate,
  }
}

/** Advance the local revision and generate the stable ID used for its sync retry. */
function nextVersion(
  current: VersionedProgress,
  progress: Progress,
  recordActivity = true,
): VersionedProgress {
  const revision = current.revision + 1
  return {
    progress,
    revision,
    eventId: `${current.eventId.split(':')[0]}:${revision}`,
    recordActivity,
  }
}

/** Generate a per-tab namespace for learning events without exposing user identifiers. */
function createEventId(): string {
  try {
    return crypto.randomUUID()
  } catch {
    return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }
}
