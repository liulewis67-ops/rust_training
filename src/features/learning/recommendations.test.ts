import { expect, it } from 'vitest'
import { lessons } from '../catalog'
import { createProgress } from './model'
import { buildLearningRecommendations } from './recommendations'

// New learners get a real first lesson and a separate link to content still in planning.
it('provides useful entries for unstarted and unavailable content', () => {
  const recommendations = buildLearningRecommendations(
    lessons,
    createProgress(),
  )

  expect(recommendations[0]).toMatchObject({
    status: 'in_progress',
    destination: 'lesson',
    destinationLessonId: 'ownership',
  })
  expect(recommendations[1]).toMatchObject({
    status: 'not_started',
    destination: 'lesson',
    destinationLessonId: 'ownership',
  })
  expect(recommendations[2]).toMatchObject({
    status: 'no_content',
    destination: 'track',
  })
})

// Continue the active lesson and route a learner to the first visible prerequisite gap.
it('explains continue and missing-prerequisite choices', () => {
  const progress = {
    ...createProgress(),
    currentLesson: 'ownership',
    currentPositionAt: '2026-10-12T10:00:00.000Z',
  }

  const recommendations = buildLearningRecommendations(lessons, progress)

  expect(recommendations[0]).toMatchObject({
    status: 'in_progress',
    destinationLessonId: 'ownership',
  })
  expect(recommendations[1]).toMatchObject({
    status: 'not_started',
    destinationLessonId: 'ownership',
  })
  expect(recommendations[1].reason).toContain('先修缺口')
})

// Self-reported completion remains transparent and never becomes an ability rating.
it('labels completed evidence as self-reported rather than verified skill', () => {
  const recommendations = buildLearningRecommendations(lessons, {
    ...createProgress(),
    completed: lessons.slice(0, 8).map((lesson) => lesson.id),
  })

  expect(recommendations[1].title).toContain('已开放课程均已标记完成')
  expect(recommendations[1].reason).toContain('不代表平台已验证能力')
  expect(recommendations[1].destination).toBe('none')
  expect(recommendations[0].destination).toBe('track')
})
