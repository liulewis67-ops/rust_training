import { describe, expect, it } from 'vitest'
import { organizeLessonMarkdown } from '../features/reading/lessonStructure'

const published = import.meta.glob<string>(
  '../../content/releases/m0?-l0?.md',
  { query: '?raw', import: 'default', eager: true },
)
const checkedLessons = Object.entries(published).filter(([path]) =>
  /\/m0[1-8]-l0[1-6]\.md$/.test(path),
)

describe('M01–M08 published curriculum transfer contract', () => {
  it('has all 48 reviewed lessons, not exercise sheets or draft content', () => {
    expect(checkedLessons).toHaveLength(48)
    const ids = checkedLessons.map(([path]) => path.split('/').pop())
    expect(new Set(ids).size).toBe(48)
  })

  it.each(checkedLessons)(
    '%s preserves its scenario-specific practice and readable structure',
    (path, markdown) => {
      const id = /\/(m0[1-8]-l0[1-6])\.md$/.exec(path)?.[1].toUpperCase()
      expect(id).toBeDefined()
      expect(markdown).toMatch(new RegExp(`^# ${id}(?:：|\\s)`))
      expect(markdown).toMatch(/^## 来源$/m)

      const headings = markdown.match(/^## 实践迁移：.+$/gm) ?? []
      expect(headings, `${path}: expected one real transfer challenge`).toHaveLength(1)
      const body = markdown.replace(/^# [^\n]+\n/, '')
      const sections = organizeLessonMarkdown(body)
      const practice = sections.filter((section) =>
        section.title?.startsWith('实践迁移：'),
      )
      expect(practice).toHaveLength(1)
      expect(practice[0].kind).toBe('apply')
      expect(practice[0].step).toBeNull()

      for (const contract of [
        '**先预测：**',
        '**动手改造：**',
        '**反例与边界：**',
        '**验收证据：**',
      ]) {
        expect(practice[0].markdown).toContain(contract)
      }

      const fences = markdown.match(/^(?:```+|~~~+)/gm) ?? []
      expect(fences.length % 2, `${path}: unbalanced code fences`).toBe(0)
    },
  )
})
