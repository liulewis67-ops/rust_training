import { expect, it } from 'vitest'
import publicManifest from '../../content/public-course-manifest.json'
import {
  loadAllPublishedCourseLessons,
  loadCourseLesson,
  resolveCourseAsset,
} from './courseCatalog'

it('falls back to source Markdown when a translation is not published', async () => {
  const chinese = await loadCourseLesson('M01', 'L01', 'zh')
  const english = await loadCourseLesson('M01', 'L01', 'en')
  expect(chinese?.content).toMatch(/^# M01-L01：/)
  expect(english?.content).toBe(chinese?.content)
  expect(english?.translationComplete).toBe(false)
  expect(english?.exercises).toEqual(chinese?.exercises)
})

it('keeps download links valid when no translated archive exists', () => {
  const chinese = resolveCourseAsset('./m01-l06-reference.zip', 'zh')
  const english = resolveCourseAsset('./m01-l06-reference.zip', 'en')
  expect(chinese).toBeTruthy()
  expect(english).toBe(chinese)
})

it('loads exactly the published lessons in English mode with explicit fallbacks', async () => {
  const lessons = await loadAllPublishedCourseLessons('en')
  expect(lessons).toHaveLength(publicManifest.markdown_lessons.length)
  expect(lessons.every((lesson) => lesson.content.trim().length > 0)).toBe(
    true,
  )
  expect(lessons.some((lesson) => lesson.translationComplete === false)).toBe(
    true,
  )
})
