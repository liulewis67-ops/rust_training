import { expect, it } from 'vitest'
import { findPublicCourseLesson, getPublicExercise, getPublicResource } from './publicCourse'

it('loads the English public course lesson, exercise, and notes', () => {
  const lesson = findPublicCourseLesson('borrowed-text-first-token', 'en')
  expect(lesson?.title).toBe('Return the First Word in Text')
  expect(lesson?.objectives[0]).toContain('returned slice')
  expect(getPublicExercise('borrowed-text-prediction', 'en')?.prompt).toContain('lifetime relationship')
  expect(getPublicResource('lesson-notes', 'en')).toContain('# Local exercise: Return the first word')
})
