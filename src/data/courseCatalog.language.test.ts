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

it('loads translated M09 text and the matching English exercises', async () => {
  const chinese = await loadCourseLesson('M09', 'L01', 'zh')
  const english = await loadCourseLesson('M09', 'L01', 'en')
  expect(chinese?.content).toMatch(/^# M09-L01：/)
  expect(english?.content).toMatch(/^# M09-L01: Result/)
  expect(english?.content).not.toBe(chinese?.content)
  expect(english?.exercises[0]).toContain('## Reference answers')
  expect(english?.translationComplete).toBe(true)

  const lab = await loadCourseLesson('M09', 'L05', 'en')
  expect(lab?.content).toContain('content/samples/m09-starter')
  expect(lab?.translationComplete).toBe(true)
})

it('keeps download links valid when no translated archive exists', () => {
  const chinese = resolveCourseAsset('./m01-l06-reference.zip', 'zh')
  const english = resolveCourseAsset('./m01-l06-reference.zip', 'en')
  expect(chinese).toBeTruthy()
  expect(english).toBe(chinese)
})

it('loads all 54 published lessons in English with complete translation coverage', async () => {
  const lessons = await loadAllPublishedCourseLessons('en')
  expect(lessons).toHaveLength(publicManifest.markdown_lessons.length)
  expect(lessons.every((lesson) => lesson.content.trim().length > 0)).toBe(
    true,
  )
  expect(lessons.every((lesson) => lesson.translationComplete)).toBe(true)
})
