import { describe, expect, it } from 'vitest'

const zhLessons = import.meta.glob<string>(
  '../../content/releases/m0?-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)
const enLessons = import.meta.glob<string>(
  '../../content/releases/en/m0?-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)

const lessonIds = Array.from({ length: 54 }, (_, index) => {
  const module = String(Math.floor(index / 6) + 1).padStart(2, '0')
  const lesson = String((index % 6) + 1).padStart(2, '0')
  return `m${module}-l${lesson}`
})

function reasoningSection(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading)
  expect(start, `Missing reasoning section: ${heading}`).toBeGreaterThanOrEqual(
    0,
  )
  const remainder = markdown.slice(start + heading.length)
  const next = remainder.search(/^## /m)
  return next === -1 ? remainder : remainder.slice(0, next)
}

function field(section: string, marker: string): string {
  const line = section
    .split('\n')
    .find((value) => value.startsWith(`**${marker}**`))
  expect(line, `Missing closure phase ${marker}`).toBeDefined()
  const body = line?.slice(marker.length + 4).trim() ?? ''
  const minimumLength = [
    '问题：',
    'Problem:',
    '示例与证据：',
    'Example and evidence:',
  ].includes(marker)
    ? 6
    : ['复盘：', 'Review:'].includes(marker)
      ? 12
      : 24
  expect(
    body.length,
    `${marker} must explain a lesson-specific decision`,
  ).toBeGreaterThan(minimumLength)
  return body
}

describe('M01–M09 lesson-specific reasoning and verification', () => {
  it('covers exactly 54 released lessons in both languages', () => {
    expect(Object.keys(zhLessons)).toHaveLength(54)
    expect(Object.keys(enLessons)).toHaveLength(54)
  })

  it('makes every reasoning, counterexample, practice and review specific', () => {
    const zhPrinciples = new Set<string>()
    const enPrinciples = new Set<string>()

    for (const id of lessonIds) {
      const zh = zhLessons[`../../content/releases/${id}.md`]
      const en = enLessons[`../../content/releases/en/${id}.md`]
      expect(zh, `Missing Chinese ${id}`).toBeDefined()
      expect(en, `Missing English ${id}`).toBeDefined()

      const zhSection = reasoningSection(zh, '## 原理推导与反例辨析：')
      const enSection = reasoningSection(
        en,
        '## Reason through a counterexample:',
      )

      for (const marker of [
        '问题：',
        '原理与推导：',
        '示例与证据：',
        '反例：',
        '独立练习：',
        '复盘：',
      ]) {
        field(zhSection, marker)
      }
      for (const marker of [
        'Problem:',
        'Principle and deduction:',
        'Example and evidence:',
        'Counterexample:',
        'Independent exercise:',
        'Review:',
      ]) {
        field(enSection, marker)
      }
      zhPrinciples.add(field(zhSection, '原理与推导：'))
      enPrinciples.add(field(enSection, 'Principle and deduction:'))

      expect(zh).toMatch(/^## 来源$/m)
      expect(en).toMatch(/^## Sources$/m)
      expect((zh.match(/^(?:```|~~~)/gm) ?? []).length % 2).toBe(0)
      expect((en.match(/^(?:```|~~~)/gm) ?? []).length % 2).toBe(0)
    }
    expect(zhPrinciples.size).toBe(54)
    expect(enPrinciples.size).toBe(54)
  })
})
