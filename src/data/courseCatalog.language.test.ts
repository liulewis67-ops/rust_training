import { expect, it } from 'vitest'
import { loadAllPublishedCourseLessons, loadCourseLesson, resolveCourseAsset } from './courseCatalog'

it('loads English lesson text and exercises for translated releases', async () => {
  const lesson = await loadCourseLesson('M01', 'L01', 'en')
  expect(lesson?.translationComplete).toBe(true)
  expect(lesson?.content).toMatch(/^# M01-L01: /)
  expect(lesson?.content).not.toContain('选择语言是在约束下做工程取舍')
  expect(lesson?.exercises.join(' ')).toContain('Answer Contract')
})

it('keeps Chinese as the default language', async () => {
  const lesson = await loadCourseLesson('M01', 'L01')
  expect(lesson?.content).toContain('选择语言是在约束下做工程取舍')
})

it('uses the English exercise download when one is available', () => {
  const chinese = resolveCourseAsset('./m01-l06-reference.zip', 'zh')
  const english = resolveCourseAsset('./m01-l06-reference.zip', 'en')
  expect(chinese).toBeTruthy()
  expect(english).toBeTruthy()
  expect(english).not.toBe(chinese)
})

it('has English Markdown for every published course lesson and its exercise files', async () => {
  const lessons = await loadAllPublishedCourseLessons('en')
  expect(lessons).toHaveLength(144)
  expect(lessons.every((lesson) => lesson.translationComplete && lesson.content.trim())).toBe(true)
})
