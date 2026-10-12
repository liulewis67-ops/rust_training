/** 原型答题记录仅为本地练习证据；selfScore 表示查看参考后的自评。 */
export interface Attempt {
  exerciseId: string
  lessonId: string
  correct: boolean
  selfScore?: number
  source?: 'learner_reported' | 'legacy_self_reported'
  answer: string | number
  at: string
}

export interface Progress {
  completed: string[]
  currentLesson: string
  currentPositionAt: string | null
  attempts: Attempt[]
  reflections: Record<string, { content: string; updatedAt: string }>
  weakness: Record<string, number>
  streak: number
  lastStudyDate: string | null
  timeZone: string
}

export interface ProgressSummary {
  completedCount: number
  answered: number
  accuracy: number | null
  weakTags: [string, number][]
}
