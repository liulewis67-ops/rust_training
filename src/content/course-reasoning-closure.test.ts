import { describe, expect, it } from 'vitest'

const zhLessons = import.meta.glob<string>('../../content/releases/m0?-l0?.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const enLessons = import.meta.glob<string>(
  '../../content/releases/en/m0?-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)

function reasoningSection(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading)
  expect(start).toBeGreaterThanOrEqual(0)
  const rest = markdown.slice(start + heading.length)
  const next = rest.search(/^## /m)
  return next === -1 ? rest : rest.slice(0, next)
}

describe('M01–M09 technical reasoning is connected prose, not a worksheet', () => {
  it('preserves all 54 Chinese and English explanations', () => {
    expect(Object.keys(zhLessons)).toHaveLength(54)
    expect(Object.keys(enLessons)).toHaveLength(54)
    const zhReasoning = new Set<string>()
    const enReasoning = new Set<string>()

    for (let moduleNo = 1; moduleNo <= 9; moduleNo += 1) {
      for (let lessonNo = 1; lessonNo <= 6; lessonNo += 1) {
        const id = `m${String(moduleNo).padStart(2, '0')}-l${String(lessonNo).padStart(2, '0')}`
        const zh = zhLessons[`../../content/releases/${id}.md`]
        const en = enLessons[`../../content/releases/en/${id}.md`]
        expect(zh).toBeDefined()
        expect(en).toBeDefined()

        for (const [page, heading, minimum, unique] of [
          [zh, '## 原理推导与反例辨析：', 190, zhReasoning],
          [en, '## Reason through a counterexample:', 290, enReasoning],
        ] as const) {
          const section = reasoningSection(page, heading).trim()
          const paragraphs = section.split(/\n\s*\n/).filter(Boolean)
          expect(paragraphs.length, `${id}: should be a continuous worked argument`)
            .toBeGreaterThanOrEqual(4)
          expect(section.length, `${id}: thin reasoning body`).toBeGreaterThan(
            minimum,
          )
          expect(section).not.toMatch(
            /^\*\*(?:问题：|原理与推导：|示例与证据：|反例：|独立练习：|复盘：|Problem:|Principle and deduction:|Example and evidence:|Counterexample:|Independent exercise:|Review:)\*\*/m,
          )
          expect(section).not.toMatch(/^[-*] |^\d+\. /m)
          expect(unique.has(section)).toBe(false)
          unique.add(section)
          expect(page).toMatch(/^## (?:来源|Sources)$/m)
          expect((page.match(/^(?:```|~~~)/gm) ?? []).length % 2).toBe(0)
        }
      }
    }
    expect(zhReasoning.size).toBe(54)
    expect(enReasoning.size).toBe(54)
  })
})
