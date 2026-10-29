import { describe, expect, it } from 'vitest'
import curriculum from '../../content/course-continuity.json'
import { organizeLessonMarkdown } from '../features/reading/lessonStructure'

const zhPages = import.meta.glob<string>('../../content/releases/m0?-l0?.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const enPages = import.meta.glob<string>(
  '../../content/releases/en/m0?-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)
const steps = curriculum.modules.flatMap((module) => module.steps)

describe('54 bilingual lessons form a continuous engineering curriculum', () => {
  it('covers exactly 54 published lessons in each language', () => {
    expect(steps).toHaveLength(54)
    expect(Object.keys(zhPages)).toHaveLength(54)
    expect(Object.keys(enPages)).toHaveLength(54)
  })

  it.each(steps)(
    '$id explains its dependency, decision, evidence and the next problem',
    (step) => {
      const key = step.id.toLowerCase()
      const zh = zhPages[`../../content/releases/${key}.md`]
      const en = enPages[`../../content/releases/en/${key}.md`]
      expect(zh).toContain(`## 工程推进：${step.label.zh}`)
      expect(en).toContain(`## Engineering thread: ${step.label.en}`)

      for (const [page, language] of [
        [zh, 'zh'],
        [en, 'en'],
      ] as const) {
        expect(page).toContain(step.problem[language])
        expect(page).toContain(step.decision[language])
        expect(page).toContain(step.artifact[language])
        expect(page).toContain(step.evidence[language])
      }

      const stepIndex = steps.findIndex((s) => s.id === step.id)
      const previous = steps[stepIndex - 1]
      const next = steps[stepIndex + 1]
      if (previous) {
        expect(zh).toContain(previous.id)
        expect(zh).toContain(previous.artifact.zh)
        expect(en).toContain(previous.id)
        expect(en).toContain(previous.artifact.en)
      }
      if (next) {
        expect(zh).toContain(next.id)
        expect(zh).toContain(next.problem.zh)
        expect(en).toContain(next.id)
        expect(en).toContain(next.problem.en)
      }

      const zhSections = organizeLessonMarkdown(zh.replace(/^# [^\n]+\n/, ''))
      const enSections = organizeLessonMarkdown(en.replace(/^# [^\n]+\n/, ''))
      const zhThread = zhSections.filter((s) =>
        s.title?.startsWith('工程推进：'),
      )
      const enThread = enSections.filter((s) =>
        s.title?.startsWith('Engineering thread:'),
      )
      expect(zhThread).toHaveLength(1)
      expect(enThread).toHaveLength(1)
      expect(zhThread[0].kind).toBe('prepare')
      expect(enThread[0].kind).toBe('prepare')
      expect(zhThread[0].step).toBeNull()
      expect(enThread[0].step).toBeNull()
    },
  )
})
