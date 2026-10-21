import { expect, it } from 'vitest'
import { courseModules } from './courseCatalog'
import { lessonTitle, moduleText, phaseText } from './courseText'
import { learningTrack } from './learningTrack'

it('provides English names and outcomes for every catalog entry', () => {
  expect(courseModules).toHaveLength(24)
  for (const module of courseModules) {
    expect(moduleText(module.id, 'en', 'title', module.title)).not.toMatch(/\p{Script=Han}/u)
    expect(moduleText(module.id, 'en', 'outcome', module.outcome)).not.toMatch(/\p{Script=Han}/u)
    expect(module.lessons).toHaveLength(6)
    for (const lesson of module.lessons) {
      expect(lessonTitle(module.id, lesson.id, 'en', lesson.title)).not.toMatch(/\p{Script=Han}/u)
      expect(lessonTitle(module.id, lesson.id, 'zh', lesson.title)).toBe(lesson.title)
    }
  }
  for (const phase of learningTrack.phases) {
    expect(phaseText(phase.id, 'en', 'title', phase.title)).not.toMatch(/\p{Script=Han}/u)
    expect(phaseText(phase.id, 'en', 'outcome', phase.outcome)).not.toMatch(/\p{Script=Han}/u)
  }
})
