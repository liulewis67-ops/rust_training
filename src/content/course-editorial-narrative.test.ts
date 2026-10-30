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
  expect(thread, 'missing engineering context before narrative').toBeGreaterThan(0)
  const article = lines.findIndex(
    (line, index) => index > thread && line.startsWith('## '),
  )
  expect(article, 'missing editorial article section').toBeGreaterThan(thread)
  const end = lines.findIndex(
    (line, index) => index > article && line.startsWith('## '),
  )
  expect(end, 'article body must end at a subsequent section').toBeGreaterThan(article)
  return {
    title: lines[article].slice(3),
    paragraphs: lines
      .slice(article + 1, end)
      .join('\n')
      .trim()
      .split(/\n\s*\n/)
      .filter((text) => text.trim()),
  }
}

describe('published lessons read as technical articles, not numbered slide outlines', () => {
  it('covers all 54 articles in Chinese and English', () => {
    expect(Object.keys(chinese)).toHaveLength(54)
    expect(Object.keys(english)).toHaveLength(54)
  })

  it('provides a distinct engineering story and reasoning in each language', () => {
    const titles = { zh: new Set<string>(), en: new Set<string>() }
    for (let moduleNo = 1; moduleNo <= 9; moduleNo += 1) {
      for (let lessonNo = 1; lessonNo <= 6; lessonNo += 1) {
        const id = `m${String(moduleNo).padStart(2, '0')}-l${String(lessonNo).padStart(2, '0')}`
        for (const [lang, lessons, prefix] of [
          ['zh', chinese, '工程推进：'],
          ['en', english, 'Engineering thread:'],
        ] as const) {
          const markdown = lessons[
            `../../content/releases/${lang === 'en' ? 'en/' : ''}${id}.md`
          ]
          expect(markdown, `missing ${lang} narrative for ${id}`).toBeDefined()
          const article = narrative(markdown, prefix)
          expect(article.title.length).toBeGreaterThan(8)
          expect(titles[lang].has(article.title), `duplicated article title ${id}`).toBe(false)
          titles[lang].add(article.title)
          expect(article.paragraphs.length, `short article narrative ${id} ${lang}`)
            .toBeGreaterThanOrEqual(2)
          expect(article.paragraphs.join('').length, `thin article narrative ${id} ${lang}`)
            .toBeGreaterThan(lang === 'zh' ? 120 : 175)
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
