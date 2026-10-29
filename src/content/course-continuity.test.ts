import { describe, expect, it } from 'vitest'
import curriculum from '../../content/course-continuity.json'
import {
  findContinuity,
  locateContinuity,
  adjacentContinuity,
} from '../data/learningContinuity'
import { organizeLessonMarkdown } from '../features/reading/lessonStructure'

const pilotChinese = import.meta.glob<string>(
  '../../content/releases/m01-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)
const pilotEnglish = import.meta.glob<string>(
  '../../content/releases/en/m01-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)

describe('Coherent, bilingual engineering lesson dependencies', () => {
  it('defines one ordered, unique step for each of the 54 published course lessons', () => {
    expect(curriculum.modules).toHaveLength(9)
    const ids = curriculum.modules.flatMap((m) => m.steps.map((s) => s.id))
    expect(ids).toHaveLength(54)
    expect(new Set(ids).size).toBe(54)
    for (const module of curriculum.modules) {
      expect(module.steps).toHaveLength(6)
      expect(module.goal.zh.length).toBeGreaterThan(6)
      expect(module.goal.en.length).toBeGreaterThan(6)
      for (const step of module.steps) {
        for (const field of [
          step.label,
          step.problem,
          step.decision,
          step.artifact,
          step.evidence,
        ]) {
          expect(field.zh.trim().length).toBeGreaterThan(4)
          expect(field.en.trim().length).toBeGreaterThan(4)
        }
        expect(locateContinuity(module.id, step.id.slice(-3))?.step.id).toBe(
          step.id,
        )
      }
    }
    expect(findContinuity('M10')).toBeUndefined()
  })

  it('connects the final artifact of one module to the next module', () => {
    const last = adjacentContinuity('M01', 'L06')
    expect(last.previous?.id).toBe('M01-L05')
    expect(last.next?.id).toBe('M02-L01')
    expect(adjacentContinuity('M09', 'L06').next).toBeUndefined()
    expect(adjacentContinuity('M01', 'L01').previous).toBeUndefined()
  })

  it.each(['m01-l01', 'm01-l02', 'm01-l03', 'm01-l04', 'm01-l05', 'm01-l06'])(
    '%s has matching Chinese and English reasoning bridges',
    (id) => {
      const zh = pilotChinese[`../../content/releases/${id}.md`]
      const en = pilotEnglish[`../../content/releases/en/${id}.md`]
      const step = locateContinuity('M01', id.slice(-3))?.step
      expect(step).toBeDefined()
      expect(zh).toContain(`## 工程推进：${step?.label.zh}`)
      expect(en).toContain(`## Engineering thread: ${step?.label.en}`)
      for (const marker of [
        '**从哪里来：**',
        '**当前问题：**',
        '**本节决策：**',
        '**完成产物：**',
        '**验证证据：**',
        '**为什么下一节需要它：**',
      ]) {
        expect(zh).toContain(marker)
      }
      for (const marker of [
        '**Carry forward:**',
        '**Current obstacle:**',
        '**Decision to make:**',
        '**Deliverable:**',
        '**Evidence:**',
        '**Why it leads forward:**',
      ]) {
        expect(en).toContain(marker)
      }
      const body = zh.replace(/^# [^\n]+\n/, '')
      const section = organizeLessonMarkdown(body).find((s) =>
        s.title?.startsWith('工程推进：'),
      )
      expect(section?.kind).toBe('prepare')
      expect(section?.step).toBeNull()
    },
  )
})
