import type { Lesson } from '../../types/lesson'
import type { Progress } from './types'

export type RecommendationStatus = 'in_progress' | 'not_started' | 'no_content'
export type RecommendationDestination = 'lesson' | 'track' | 'none'

export interface LearningRecommendation {
  status: RecommendationStatus
  title: string
  reason: string
  destination: RecommendationDestination
  destinationLessonId?: string
}

/** Build three explainable next-step cards from the published course boundary and learner records. */
export function buildLearningRecommendations(
  lessons: readonly Lesson[],
  progress: Progress,
): LearningRecommendation[] {
  const ordered = [...lessons].sort((left, right) => {
    // Keep recommendation order aligned with the learner-facing route.
    return left.order - right.order
  })
  const available = ordered.filter((lesson) => {
    // The first eight lessons are the current published prototype boundary.
    return lesson.order <= 8
  })
  const planned = ordered.find((lesson) => {
    // Later lessons have route descriptions but are not open learning content.
    return lesson.order > 8
  })
  const completed = new Set(progress.completed)
  const started = new Set<string>()
  for (const attempt of progress.attempts) started.add(attempt.lessonId)
  for (const lessonId of Object.keys(progress.reflections))
    started.add(lessonId)
  if (progress.currentPositionAt) started.add(progress.currentLesson)

  const current = available.find((lesson) => {
    // Continue only a visited, unfinished lesson that currently has content.
    return (
      lesson.id === progress.currentLesson &&
      started.has(lesson.id) &&
      !completed.has(lesson.id)
    )
  })
  const unfinished = available.find((lesson) => {
    // Select the first available lesson without a completion or prior activity record.
    return !completed.has(lesson.id) && !started.has(lesson.id)
  })
  let missingPrerequisite: Lesson | undefined
  if (unfinished) {
    for (const id of unfinished.prerequisites) {
      const prerequisite = available.find((lesson) => {
        // Resolve a prerequisite only against content that is currently open.
        return lesson.id === id
      })
      if (prerequisite && !completed.has(prerequisite.id)) {
        missingPrerequisite = prerequisite
        break
      }
    }
  }
  const noContent: LearningRecommendation = planned
    ? {
        status: 'no_content',
        title: planned.title,
        reason: '该阶段仍在规划中；目前有路线目标说明，没有已开放课件。',
        destination: 'track',
      }
    : {
        status: 'no_content',
        title: '后续课程规划',
        reason: '当前没有更多课程内容可打开。',
        destination: 'track',
      }

  const inProgress: LearningRecommendation = current
    ? {
        status: 'in_progress',
        title: current.title,
        reason: '最近访问的位置仍未标记完成，可以从这里继续。',
        destination: 'lesson',
        destinationLessonId: current.id,
      }
    : unfinished
      ? {
          status: 'in_progress',
          title: unfinished.title,
          reason: '还没有正在进行的课程；可以从第一节未开始课程开始。',
          destination: 'lesson',
          destinationLessonId: unfinished.id,
        }
      : {
          status: 'in_progress',
          title: '已开放课程均已标记完成',
          reason: '完成记录由学习者自报；可查看路线规划中的后续学习方向。',
          destination: 'track',
        }

  return [
    inProgress,
    unfinished
      ? {
          status: 'not_started',
          title: unfinished.title,
          reason: missingPrerequisite
            ? `先修缺口：${missingPrerequisite.title}。完成状态仅表示自报阅读记录。`
            : '这节课尚未开始；推荐依据课程先修顺序。',
          destination: 'lesson',
          destinationLessonId: missingPrerequisite?.id ?? unfinished.id,
        }
      : {
          status: 'not_started',
          title: '已开放课程均已标记完成',
          reason: '标记完成是自报阅读记录，不代表平台已验证能力。',
          destination: 'none',
        },
    noContent,
  ]
}
