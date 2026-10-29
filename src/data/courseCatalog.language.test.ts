import { expect, it } from 'vitest'
import publicManifest from '../../content/public-course-manifest.json'
import {
  loadAllPublishedCourseLessons,
  loadCourseLesson,
  resolveCourseAsset,
} from './courseCatalog'

it('loads genuine English content and exercises for the translated M01 module', async () => {
  const chinese = await loadCourseLesson('M01', 'L01', 'zh')
  const english = await loadCourseLesson('M01', 'L01', 'en')
  expect(chinese?.content).toMatch(/^# M01-L01：/)
  expect(english?.content).toMatch(/^# M01-L01: Why Rust/)
  expect(english?.translationComplete).toBe(true)
  expect(english?.exercises[0]).toContain('## Reference answers')
  expect(english?.content).not.toBe(chinese?.content)
})

it('falls back to Chinese only where English translation is not yet published', async () => {
  const chinese = await loadCourseLesson('M09', 'L01', 'zh')
  const english = await loadCourseLesson('M09', 'L01', 'en')
  expect(english?.content).toBe(chinese?.content)
  expect(english?.translationComplete).toBe(false)
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
