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

function narrative(markdown: string, prefix: string) {
  const lines = markdown.split(/\r?\n/)
  const thread = lines.findIndex((line) => line.startsWith('## ' + prefix))
  expect(thread).toBeGreaterThan(0)
  const nextHeading = (line: string, index: number) =>
    index > thread && line.startsWith('## ')
  const article = lines.findIndex(nextHeading)
  expect(article).toBeGreaterThan(thread)
  const end = lines.findIndex(
    (line, index) => index > article && line.startsWith('## '),
  )
  expect(end).toBeGreaterThan(article)
  const body = lines.slice(article + 1, end).join('\n').trim()
  return {
    title: lines[article].slice(3),
    paragraphs: body.split(/\n\s*\n/).filter((text) => text.trim()),
  }
}

describe('published articles keep a story, not numbered slide headings', () => {
  it('covers all 54 lessons in each language', () => {
    expect(Object.keys(chinese)).toHaveLength(54)
    expect(Object.keys(english)).toHaveLength(54)
  })

  it('gives each lesson a unique, substantive engineering narrative', () => {
    const titles = { zh: new Set<string>(), en: new Set<string>() }
    for (let moduleNo = 1; moduleNo <= 9; moduleNo += 1) {
      const moduleId = `m${String(moduleNo).padStart(2, '0')}`
      for (let lessonNo = 1; lessonNo <= 6; lessonNo += 1) {
        const lessonId = `l${String(lessonNo).padStart(2, '0')}`
        const id = `${moduleId}-${lessonId}`
        for (const [lang, lessons, prefix] of [
          ['zh', chinese, '工程推进：'],
          ['en', english, 'Engineering thread:'],
        ] as const) {
          const dir = lang === 'en' ? 'en/' : ''
          const path = `../../content/releases/${dir}${id}.md`
          const markdown = lessons[path]
          expect(markdown).toBeDefined()
          const article = narrative(markdown, prefix)
          expect(article.title.length).toBeGreaterThan(8)
          expect(titles[lang].has(article.title)).toBe(false)
          titles[lang].add(article.title)
          expect(article.paragraphs.length).toBeGreaterThanOrEqual(2)
          const length = article.paragraphs.join('').length
          expect(length).toBeGreaterThan(lang === 'zh' ? 120 : 175)
          for (const paragraph of article.paragraphs) {
            expect(paragraph).not.toMatch(/^[-*] |^\d+\. /)
          }
          expect(markdown).not.toMatch(/^## 核心知识点[一二三四五六]/m)
          expect(markdown).not.toMatch(/^## Core concept \d+:/m)
        }
      }
    }
    expect(titles.zh.size).toBe(54)
    expect(titles.en.size).toBe(54)
  })
})
