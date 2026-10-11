/** 原型答题记录仅为本地练习证据；selfScore 表示查看参考后的自评。 */
export interface Attempt {
  exerciseId: string
  lessonId: string
  correct: boolean
  selfScore?: number
  answer: string | number
  at: string
}

export interface Progress {
  completed: string[]
  currentLesson: string
  attempts: Attempt[]
  weakness: Record<string, number>
  streak: number
  lastStudyDate: string | null
}

export interface ProgressSummary {
  completedCount: number
  answered: number
  accuracy: number | null
  weakTags: [string, number][]
}
