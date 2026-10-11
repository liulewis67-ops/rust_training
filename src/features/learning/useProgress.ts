import { useCallback, useEffect, useState } from 'react'
import type { Exercise } from '../../types/lesson'
import { markLessonComplete, recordAttempt } from './model'
import { loadProgress, saveProgress } from './progressStorage'
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
}

/** 管理原型学习状态与存储副作用；所有变更基于最新状态，避免过期闭包。 */
export function useProgress(): LearningState {
  const [loaded] = useState(loadProgress)
  const [state, setState] = useState({ progress: loaded.progress, revision: 0 })
  const [saveStatus, setSaveStatus] = useState(loaded.message)
  useEffect(() => {
    // 初次读取不写入；损坏数据保留原文，禁止挂载时用默认状态覆盖。
    if (state.revision === 0 || !loaded.canSave) return
    const result = saveProgress(state.progress)
    setSaveStatus(result.ok ? '本地进度已保存' : result.message)
  }, [state, loaded.canSave])

  /** 在路由切换时保存最后阅读课程，相同课程不重复写入。 */
  const rememberLesson = useCallback((id: string): void => {
    setState((current) => {
      // 快速连续导航也以最新状态为准。
      if (current.progress.currentLesson === id) return current
      return {
        progress: { ...current.progress, currentLesson: id },
        revision: current.revision + 1,
      }
    })
  }, [])
  /** 记录当前课程的本地自报完成状态。 */
  function completeLesson(id: string): void {
    setState((current) => {
      // 将学习日和完成标记作为一次原子状态更新。
      return {
        progress: markLessonComplete(current.progress, id),
        revision: current.revision + 1,
      }
    })
  }
  /** 课程与复习提交共用相同业务规则。 */
  function submitAttempt(
    lessonId: string,
    exercise: Exercise,
    answer: string | number,
    correct: boolean,
    score?: number,
  ): void {
    setState((current) => {
      // 同一更新中计算薄弱点、答题记录与日历连续天数。
      return {
        progress: recordAttempt(
          current.progress,
          lessonId,
          exercise,
          answer,
          correct,
          score,
        ),
        revision: current.revision + 1,
      }
    })
  }
  return {
    progress: state.progress,
    saveStatus,
    rememberLesson,
    completeLesson,
    submitAttempt,
  }
}
