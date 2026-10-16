import { expect, it } from 'vitest'
import { findCourseLesson, loadCourseLesson, resolveCourseAsset } from './courseCatalog'

it('publishes only reviewed lessons and retains their open reference answers', async () => {
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M01', `L${number}`)?.published).toBe(true)
  }
  expect((await loadCourseLesson('M01', 'L01'))?.exercises[0]).toContain(
    '### 参考答案',
  )
  expect((await loadCourseLesson('M01', 'L05'))?.content).toContain('## 参考实现')
  for (const number of ['01', '02', '03', '04', '05', '06']) {
    expect(findCourseLesson('M02', `L${number}`)?.published).toBe(true)
  }
  expect((await loadCourseLesson('M02', 'L01'))?.exercises[0]).toContain('## 参考答案')
  expect((await loadCourseLesson('M02', 'L05'))?.content).toContain('## 公开参考实现')
  expect((await loadCourseLesson('M02', 'L06'))?.content).toContain('## 参考实现')
  for (const archive of [
    'm01-l03-samples.zip',
    'm01-l04-sample.zip',
    'm01-l05-starter.zip',
    'm01-l06-reference.zip',
    'm02-l05-starter.zip',
  ]) {
    expect(resolveCourseAsset(`./${archive}`)).toBeTruthy()
  }
  expect(findCourseLesson('M03', 'L01')?.published).toBe(false)
})
