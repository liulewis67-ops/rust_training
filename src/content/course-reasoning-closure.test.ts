import { describe, expect, it } from 'vitest'

const zhLessons = import.meta.glob<string>(
  '../../content/releases/m0?-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)
const enLessons = import.meta.glob<string>(
  '../../content/releases/en/m0?-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)

function reasoningSection(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading)
  expect(start).toBeGreaterThanOrEqual(0)
  const remainder = markdown.slice(start + heading.length)
  const next = remainder.search(/^## /m)
  return next === -1 ? remainder : remainder.slice(0, next)
}

function checkProse(section: string, minimumLength: number): void {
  const paragraphs = section.trim().split(/\n\s*\n/).filter(Boolean)
  expect(paragraphs.length).toBeGreaterThanOrEqual(4)
  expect(section.length).toBeGreaterThan(minimumLength)
  expect(section).not.toContain('**问题：**')
  expect(section).not.toContain('**原理与推导：**')
  expect(section).not.toContain('**示例与证据：**')
  expect(section).not.toContain('**独立练习：**')
  expect(section).not.toContain('**Principle and deduction:**')
  expect(section).not.toContain('**Example and evidence:**')
  expect(section).not.toContain('**Independent exercise:**')
  expect(section).not.toMatch(/^[-*] |^\d+\. /m)
}

describe('M01–M09 lessons make arguments in connected prose', () => {
  it('checks all 54 bilingual explanations and retained source links', () => {
    expect(Object.keys(zhLessons)).toHaveLength(54)
    expect(Object.keys(enLessons)).toHaveLength(54)
    const chinese = new Set<string>()
    const english = new Set<string>()

    for (let index = 0; index < 54; index += 1) {
      const module = String(Math.floor(index / 6) + 1).padStart(2, '0')
      const lesson = String((index % 6) + 1).padStart(2, '0')
      const id = `m${module}-l${lesson}`
      const zh = zhLessons[`../../content/releases/${id}.md`]
      const en = enLessons[`../../content/releases/en/${id}.md`]
      expect(zh).toBeDefined()
      expect(en).toBeDefined()

      const zhSection = reasoningSection(zh, '## 原理推导与反例辨析：')
      const enSection = reasoningSection(
        en,
        '## Reason through a counterexample:',
      )
      checkProse(zhSection, 190)
      checkProse(enSection, 290)
      expect(chinese.has(zhSection)).toBe(false)
      expect(english.has(enSection)).toBe(false)
      chinese.add(zhSection)
      english.add(enSection)

      expect(zh).toMatch(/^## 来源$/m)
      expect(en).toMatch(/^## Sources$/m)
      expect((zh.match(/^(?:```|~~~)/gm) ?? []).length % 2).toBe(0)
      expect((en.match(/^(?:```|~~~)/gm) ?? []).length % 2).toBe(0)
    }
    expect(chinese.size).toBe(54)
    expect(english.size).toBe(54)
  })
})
