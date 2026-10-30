import { describe, expect, it } from 'vitest'

const chinese = import.meta.glob<string>(
  '../../content/releases/m0?-l0[56].md',
  { query: '?raw', import: 'default', eager: true },
)
const english = import.meta.glob<string>(
  '../../content/releases/en/m0?-l0[56].md',
  { query: '?raw', import: 'default', eager: true },
)

function checkLabArticle(
  page: string,
  reasoning: string,
  minimum: number,
  titles: Set<string>,
): void {
  const sections = page.split(/^## /m)
  const reasoningIndex = sections.findIndex((part) =>
    part.startsWith(reasoning),
  )
  expect(reasoningIndex).toBeGreaterThan(0)
  const article = sections[reasoningIndex + 1]
  expect(article).toBeDefined()
  const [heading, ...body] = article.split('\n')
  expect(heading.length).toBeGreaterThan(16)
  expect(titles.has(heading)).toBe(false)
  titles.add(heading)
  const text = body.join('\n').trim()
  expect(text.length).toBeGreaterThan(minimum)
  const paragraphs = text.split(/\n\s*\n/)
  expect(paragraphs).toHaveLength(4)
  expect(text).not.toMatch(/^[-*] |^\d+\. /m)
  expect(text).not.toContain('**问题：**')
  expect(text).not.toContain('**Problem:**')
}

describe('M01–M09 lab articles explain a complete debugging journey', () => {
  it('covers every L05 and L06 in both published languages', () => {
    expect(Object.keys(chinese)).toHaveLength(18)
    expect(Object.keys(english)).toHaveLength(18)
    const zhTitles = new Set<string>()
    const enTitles = new Set<string>()

    for (let module = 1; module <= 9; module += 1) {
      for (const lesson of [5, 6]) {
        const id = `m0${module}-l0${lesson}`
        const zh = chinese[`../../content/releases/${id}.md`]
        const en = english[`../../content/releases/en/${id}.md`]
        expect(zh).toBeDefined()
        expect(en).toBeDefined()
        checkLabArticle(zh, '原理推导与反例辨析：', 450, zhTitles)
        checkLabArticle(en, 'Reason through a counterexample:', 750, enTitles)
      }
    }
    expect(zhTitles.size).toBe(18)
    expect(enTitles.size).toBe(18)
  })
})
