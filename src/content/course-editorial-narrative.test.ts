import { describe, expect, it } from 'vitest'

const chinese = import.meta.glob<string>('../../content/releases/m0?-l0?.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const english = import.meta.glob<string>(
  '../../content/releases/en/m0?-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)

function checkArticle(
  markdown: string,
  thread: string,
  titles: Set<string>,
  minimum: number,
) {
  const sections = markdown.split(/^## /m)
  const index = sections.findIndex((section) => section.startsWith(thread))
  expect(index).toBeGreaterThan(0)
  const story = sections[index + 1]
  expect(story).toBeDefined()
  const title = story.split('\n')[0]
  expect(title.length).toBeGreaterThan(8)
  expect(titles.has(title)).toBe(false)
  titles.add(title)
  const paragraphs = story.split(/\n\s*\n/).slice(1)
  expect(paragraphs.length).toBeGreaterThanOrEqual(2)
  expect(paragraphs.join('').length).toBeGreaterThan(minimum)
  expect(story).not.toMatch(/^[-*] |^\d+\. /m)
  expect(markdown).not.toMatch(/^## 核心知识点/m)
  expect(markdown).not.toMatch(/^## Core concept/m)
}

describe('54 bilingual courses use article-style explanations', () => {
  it('preserves a unique narrative for every published lesson', () => {
    const zhLessons = Object.entries(chinese)
    expect(zhLessons).toHaveLength(54)
    expect(Object.keys(english)).toHaveLength(54)
    const zhTitles = new Set<string>()
    const enTitles = new Set<string>()
    for (const [path, zh] of zhLessons) {
      const enPath = path.replace('/releases/', '/releases/en/')
      const en = english[enPath]
      expect(en).toBeDefined()
      checkArticle(zh, '工程推进：', zhTitles, 120)
      checkArticle(en, 'Engineering thread:', enTitles, 175)
    }
    expect(zhTitles.size).toBe(54)
    expect(enTitles.size).toBe(54)
  })
})
