import { describe, expect, it } from 'vitest'
import { organizeLessonMarkdown } from '../features/reading/lessonStructure'
import { loadAllPublishedCourseLessons } from '../data/courseCatalog'

const chinese = import.meta.glob<string>('../../content/releases/m0?-l0?.md', {
  query: '?raw',
  import: 'default',
  eager: true,
})
const english = import.meta.glob<string>(
  '../../content/releases/en/m0?-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)
const englishExercises = import.meta.glob<string>(
  '../../content/releases/en/m0?-l0?-exercises.md',
  { query: '?raw', import: 'default', eager: true },
)

function codeBlocks(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/)
  const blocks: string[] = []
  let opened: { marker: string; length: number; lines: string[] } | null = null

  for (const line of lines) {
    const fence = /^\s*(`{3,}|~{3,})(?:\w+)?\s*$/.exec(line)
    if (!opened) {
      if (fence) {
        opened = { marker: fence[1][0], length: fence[1].length, lines: [line] }
      }
      continue
    }
    opened.lines.push(line)
    if (
      fence &&
      fence[1][0] === opened.marker &&
      fence[1].length >= opened.length
    ) {
      blocks.push(opened.lines.join('\n'))
      opened = null
    }
  }
  expect(opened, 'Unclosed fenced code block').toBeNull()
  return blocks
}

const ids = Array.from(
  { length: 48 },
  (_, i) =>
    `m${String(Math.floor(i / 6) + 1).padStart(2, '0')}-l${String((i % 6) + 1).padStart(2, '0')}`,
)

describe('M01–M08 bilingual course parity', () => {
  it('has 48 English lesson files and 32 matching English practice sheets', () => {
    expect(Object.keys(english)).toHaveLength(48)
    expect(Object.keys(englishExercises)).toHaveLength(32)
  })

  it.each(ids)(
    '%s has English practice, original Rust snippets and source links',
    (id) => {
      const source = chinese[`../../content/releases/${id}.md`]
      const translated = english[`../../content/releases/en/${id}.md`]
      expect(source, `missing Chinese source ${id}`).toBeDefined()
      expect(translated, `missing English lesson ${id}`).toBeDefined()
      expect(translated).toMatch(new RegExp(`^# ${id.toUpperCase()}:`))
      expect(translated).toContain('## Learning objectives')
      expect(translated).toContain('## Java / Go comparison')
      expect(translated).toContain('## Sources')
      expect(translated).toMatch(/^## Practice transfer: .+$/m)

      const required = [
        '**Predict:**',
        '**Implement:**',
        '**Counterexample and boundaries:**',
        '**Acceptance evidence:**',
      ]
      for (const marker of required) expect(translated).toContain(marker)

      // Existing Chinese examples must remain byte-for-byte unchanged in the English lesson.
      expect(codeBlocks(translated)).toEqual(codeBlocks(source))

      const sourceAssets = [...source.matchAll(/\]\(\.\/([^)]*\.zip)\)/g)]
      for (const asset of sourceAssets) {
        expect(translated).toContain(asset[1])
      }

      const body = translated.replace(/^# [^\n]+\n/, '')
      const transfer = organizeLessonMarkdown(body).filter((s) =>
        s.title?.startsWith('Practice transfer:'),
      )
      expect(transfer).toHaveLength(1)
      expect(transfer[0].kind).toBe('apply')
      expect(transfer[0].step).toBeNull()

      const lessonNo = Number(id.slice(-2))
      if (lessonNo <= 4) {
        const exercise =
          englishExercises[`../../content/releases/en/${id}-exercises.md`]
        expect(exercise).toMatch(/^# M0[1-8]-L0[1-4] Exercises:/)
        expect(exercise).toContain('## Exercise 1: Predict')
        expect(exercise).toContain('## Exercise 2:')
        expect(exercise).toContain('## Exercise 3:')
        expect(exercise).toContain('## Reference answers')
      }
    },
  )

  it('loads all 48 translated courses and keeps M09 explicitly untranslated', async () => {
    const lessons = await loadAllPublishedCourseLessons('en')
    expect(
      lessons.filter(
        (l) => /^M0[1-8]$/.test(l.moduleId) && l.translationComplete,
      ),
    ).toHaveLength(48)
    expect(
      lessons.filter((l) => l.moduleId === 'M09' && !l.translationComplete),
    ).toHaveLength(6)
  })
})
