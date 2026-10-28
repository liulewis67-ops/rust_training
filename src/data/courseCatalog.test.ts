import { expect, it } from 'vitest'
import publicManifest from '../../content/public-course-manifest.json'
import {
  courseModules,
  findCourseLesson,
  loadCourseLesson,
  resolveCourseAsset,
} from './courseCatalog'

it('publishes exactly the lessons approved by the release manifest', () => {
  const published = courseModules.flatMap((module) =>
    module.lessons
      .filter((lesson) => lesson.published)
      .map((lesson) => `${module.id}-${lesson.id}`),
  )
  expect(published).toEqual(publicManifest.markdown_lessons)
  expect(new Set(published).size).toBe(published.length)
})

it('keeps planned modules visible without publishing unreviewed lessons', async () => {
  expect(courseModules).toHaveLength(24)
  for (const module of courseModules) {
    for (const lesson of module.lessons) {
      const id = `${module.id}-${lesson.id}`
      expect(lesson.published).toBe(
        publicManifest.markdown_lessons.includes(id),
      )
    }
  }
  expect(findCourseLesson('M08', 'L01')?.published).toBe(true)
  expect((await loadCourseLesson('M08', 'L01'))?.content).toContain('Vec、HashMap 与访问策略')
  expect(findCourseLesson('M09', 'L01')?.published).toBe(true)
  expect((await loadCourseLesson('M09', 'L01'))?.content).toContain('Result、? 与错误传播')
  expect(findCourseLesson('M10', 'L01')?.published).toBe(false)
  expect(await loadCourseLesson('M10', 'L01')).toBeUndefined()
  expect(await loadCourseLesson('M24', 'L06')).toBeUndefined()
})

it('keeps lesson bodies and separate public exercises independently accessible', async () => {
  const concept = await loadCourseLesson('M01', 'L01')
  expect(concept?.content).toMatch(/^# M01-L01：/)
  expect(concept?.exercises[0]).toContain('参考答案')
  expect(concept?.content).not.toContain('# M01-L01 练习：')

  const lab = await loadCourseLesson('M01', 'L05')
  expect(lab?.content).toContain('## 参考实现')
  const assessment = await loadCourseLesson('M07', 'L06')
  expect(assessment?.content).toContain('## 参考实现')
  const m08 = await loadCourseLesson('M08', 'L01')
  expect(m08?.exercises[0]).toContain('## 参考答案')
  expect(m08?.content).toContain('## 检验理解与本地练习')
  const m09 = await loadCourseLesson('M09', 'L01')
  expect(m09?.exercises[0]).toContain('## 参考答案')
  expect(m09?.content).toContain('## 检验理解与本地练习')
})

it('resolves published downloads without manufacturing unavailable assets', () => {
  expect(resolveCourseAsset('./m01-l06-reference.zip')).toBeTruthy()
  expect(resolveCourseAsset('./m01-l03-samples.zip')).toBeTruthy()
  expect(resolveCourseAsset('./m24-l06-reference.zip')).toBeUndefined()
})
