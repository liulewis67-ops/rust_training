import { useCallback, useEffect, useState } from 'react'
import type { Exercise } from '../../types/lesson'
import {
  createProgress,
  markLessonComplete,
  recordActivity,
  recordAttempt,
} from './model'
import {
  clearStoredProgress,
  loadProgress,
  saveProgress,
} from './progressStorage'
import type { Progress } from './types'

interface LearningState {
  progress: Progress
  saveStatus: string
  rememberLesson: (id: string) => void
  completeLesson: (id: string) => void
  submitAttempt: (
    lessonId: string,
    exercise: Exercise,
    answer: string | number,
    correct: boolean,
    score?: number,
  ) => void
  clearProgress: () => void
}

/** Keep learning useful without a server and treat browser persistence as optional. */
export function useProgress(): LearningState {
  const [initial] = useState(loadProgress)
  const [progress, setProgress] = useState(initial.progress)
  const [saveStatus, setSaveStatus] = useState(initial.message)
  const [canSave, setCanSave] = useState(initial.canSave)

  useEffect(() => {
    // Never replace a damaged record; the in-memory session remains fully usable.
    if (!canSave) return
    const result = saveProgress(progress)
    setSaveStatus(result.ok ? '进度保存在此浏览器' : result.message)
    if (!result.ok) setCanSave(false)
  }, [canSave, progress])

  /** Remember the current lesson locally and update the learner-reported study day. */
  const rememberLesson = useCallback((id: string): void => {
    setProgress((current) => {
      if (current.currentLesson === id) return current
      const now = new Date()
      return {
        ...current,
        ...recordActivity(current, now),
        currentLesson: id,
        currentPositionAt: now.toISOString(),
      }
    })
  }, [])

  /** Mark a lesson complete as a learner-reported local choice. */
  const completeLesson = useCallback((id: string): void => {
    setProgress((current) => markLessonComplete(current, id))
  }, [])

  /** Save the latest local answer for this exercise without claiming certification. */
  const submitAttempt = useCallback(
    (
      lessonId: string,
      exercise: Exercise,
      answer: string | number,
      correct: boolean,
      score?: number,
    ): void => {
      setProgress((current) =>
        recordAttempt(current, lessonId, exercise, answer, correct, score),
      )
    },
    [],
  )

  /** Clear only this application's learning keys from the current browser. */
  const clearProgress = useCallback((): void => {
    const result = clearStoredProgress()
    setCanSave(result.ok)
    setSaveStatus(
      result.ok
        ? '本站学习记录已清空'
        : '记录已在本次会话清空；浏览器存储不可用',
    )
    setProgress(createProgress())
  }, [])

  return {
    progress,
    saveStatus,
    rememberLesson,
    completeLesson,
    submitAttempt,
    clearProgress,
  }
}
