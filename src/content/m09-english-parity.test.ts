import { describe, expect, it } from 'vitest'
import { loadCourseLesson } from '../data/courseCatalog'
import { organizeLessonMarkdown } from '../features/reading/lessonStructure'

const chinese = import.meta.glob<string>(
  '../../content/releases/m09-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)
const english = import.meta.glob<string>(
  '../../content/releases/en/m09-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)
const chineseExercises = import.meta.glob<string>(
  '../../content/releases/m09-l0?-exercises.md',
  { query: '?raw', import: 'default', eager: true },
)
const englishExercises = import.meta.glob<string>(
  '../../content/releases/en/m09-l0?-exercises.md',
  { query: '?raw', import: 'default', eager: true },
)

function fencedBlocks(markdown: string): string[] {
  const blocks: string[] = []
  let current: { marker: string; length: number; lines: string[] } | null = null
  for (const line of markdown.split(/\r?\n/)) {
    const fence = /^\s*(`{3,}|~{3,})(?:[\w-]+)?\s*$/.exec(line)
    if (!current) {
      if (fence) {
        current = {
          marker: fence[1][0],
          length: fence[1].length,
          lines: [line],
        }
      }
      continue
    }
    current.lines.push(line)
    if (
      fence &&
      fence[1][0] === current.marker &&
      fence[1].length >= current.length
    ) {
      blocks.push(current.lines.join('\n'))
      current = null
    }
  }
  expect(current, 'Fenced code must be closed').toBeNull()
  return blocks
}

describe('M09 English translation and error contracts', () => {
  it('contains exactly six lessons and four accompanying concept exercise sheets', () => {
    expect(Object.keys(chinese)).toHaveLength(6)
    expect(Object.keys(english)).toHaveLength(6)
    expect(Object.keys(chineseExercises)).toHaveLength(4)
    expect(Object.keys(englishExercises)).toHaveLength(4)
  })

  it.each(['m09-l01', 'm09-l02', 'm09-l03', 'm09-l04', 'm09-l05', 'm09-l06'])(
    '%s has complete English learning material and unchanged Rust examples',
    (id) => {
      const source = chinese[`../../content/releases/${id}.md`]
      const translated = english[`../../content/releases/en/${id}.md`]
      expect(source).toBeDefined()
      expect(translated).toMatch(new RegExp(`^# ${id.toUpperCase()}:`))
      expect(translated).toContain('## Sources')
      expect(translated).toContain('## Java / Go comparison')
      expect(translated).toContain('## Check your understanding')
      expect(translated).toContain('## Progressive hints')
      expect(fencedBlocks(translated)).toEqual(fencedBlocks(source))

      const originalLinks = [...source.matchAll(/\]\((https:\/\/[^)]+)\)/g)]
      for (const link of originalLinks) {
        expect(translated).toContain(link[1])
      }
      const sections = organizeLessonMarkdown(
        translated.replace(/^# [^\n]+\n/, ''),
      )
      expect(sections.some((part) => part.kind === 'prepare')).toBe(true)
      expect(sections.some((part) => part.kind === 'concept')).toBe(true)
      expect(sections.some((part) => part.kind === 'apply')).toBe(true)
      expect(sections.some((part) => part.kind === 'reference')).toBe(true)
    },
  )

  it.each(['m09-l01', 'm09-l02', 'm09-l03', 'm09-l04'])(
    '%s translates the original practice and reference answers',
    (id) => {
      const source = chineseExercises[
        `../../content/releases/${id}-exercises.md`
      ]
      const translated = englishExercises[
        `../../content/releases/en/${id}-exercises.md`
      ]
      expect(translated).toMatch(new RegExp(`^# ${id.toUpperCase()} Exercises:`))
      expect(translated).toContain('## Reference answers')
      expect(translated).toContain('## Self-check list')
      expect(translated).toContain('## Sources')
      expect(fencedBlocks(translated)).toEqual(fencedBlocks(source))
    },
  )

  it('keeps the L05 parser and L06 CLI/API acceptance contracts intact', () => {
    const parser = english['../../content/releases/en/m09-l05.md']
    for (const term of [
      'DuplicateField',
      'InvalidValue',
      'timeout_ms',
      'retry_limit',
      'chars().count()',
      'm09-starter',
      'm09-reference',
    ]) {
      expect(parser).toContain(term)
    }
    const adapter = english['../../content/releases/en/m09-l06.md']
    for (const term of [
      'invalid_retention_days',
      'profile_not_found',
      'history_unavailable',
      'retryable',
      'request_id',
      '503',
      'true',
      'm09-starter',
      'm09-reference',
    ]) {
      expect(adapter).toContain(term)
    }
  })

  it('loads all six M09 lessons and their four exercise sheets without fallback', async () => {
    for (let i = 1; i <= 6; i += 1) {
      const lessonId = `L${String(i).padStart(2, '0')}`
      const zh = await loadCourseLesson('M09', lessonId, 'zh')
      const en = await loadCourseLesson('M09', lessonId, 'en')
      expect(en?.translationComplete).toBe(true)
      expect(en?.content).not.toBe(zh?.content)
      expect(en?.content).toMatch(new RegExp(`^# M09-${lessonId}:`))
      expect(en?.exercises).toHaveLength(i <= 4 ? 1 : 0)
    }
  })
})
