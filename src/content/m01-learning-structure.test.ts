import { describe, expect, it } from 'vitest'
import l01 from '../../content/releases/m01-l01.md?raw'
import l02 from '../../content/releases/m01-l02.md?raw'
import l03 from '../../content/releases/m01-l03.md?raw'
import l04 from '../../content/releases/m01-l04.md?raw'
import l05 from '../../content/releases/m01-l05.md?raw'
import l06 from '../../content/releases/m01-l06.md?raw'

const lessons = [l01, l02, l03, l04, l05, l06]

/** Guard the educational structure of the released M01 module, not its exact prose. */
describe('M01 guided lessons', () => {
  it('keeps the six lesson IDs, goals and references', () => {
    lessons.forEach((lesson, index) => {
      const id = `M01-L${String(index + 1).padStart(2, '0')}`
      expect(lesson).toMatch(new RegExp(`^# ${id}：`))
      expect(lesson).toMatch(/^## 学习目标(?:与先修)?$/m)
      expect(lesson).toMatch(/^## 来源$/m)
      expect(lesson).toMatch(/验收|自查|检验理解/)
    })
  })

  it('teaches concepts through scenarios and practice', () => {
    lessons.slice(0, 4).forEach((lesson) => {
      // Concept sections can use natural article headings; do not mandate
      // numbered "knowledge point" labels that make a lesson read like slides.
      const story = lesson.slice(
        lesson.indexOf('\n## 工程推进：'),
        lesson.indexOf('\n## 学习目标'),
      )
      expect(story).toMatch(/\n## (?!工程推进：)[^\n]+\n\n/)
      expect(story.split('\n\n').length).toBeGreaterThan(3)
      expect(lesson).not.toMatch(/^## 核心知识点[一二三四五六]/m)
      expect(lesson).toMatch(/^## (?:检验理解|检验理解与本地练习|本地练习)/m)
      expect(lesson).toMatch(/Java\s*\/\s*Go|Java[^\n]*Go/)
      expect(lesson).toContain('--- |')
    })
  })

  it('keeps lab hints and solutions behind disclosures', () => {
    lessons.slice(4).forEach((lesson) => {
      const hints = lesson.indexOf('\n## 分层提示\n')
      const answers = lesson.indexOf('\n## 参考实现\n')
      expect(hints).toBeGreaterThan(0)
      expect(answers).toBeGreaterThan(hints)
      expect(lesson).toMatch(/^## 自查清单$/m)
    })
  })

  it('does not leave Rust code fences unclosed', () => {
    lessons.forEach((lesson) => {
      const fences = lesson.match(/^```/gm) ?? []
      expect(fences.length % 2).toBe(0)
    })
  })
})
