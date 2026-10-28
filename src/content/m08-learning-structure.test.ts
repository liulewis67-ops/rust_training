import { describe, expect, it } from 'vitest'
import l01 from '../../content/releases/m08-l01.md?raw'
import l02 from '../../content/releases/m08-l02.md?raw'
import l03 from '../../content/releases/m08-l03.md?raw'
import l04 from '../../content/releases/m08-l04.md?raw'
import l05 from '../../content/releases/m08-l05.md?raw'
import l06 from '../../content/releases/m08-l06.md?raw'
import e01 from '../../content/releases/m08-l01-exercises.md?raw'
import e02 from '../../content/releases/m08-l02-exercises.md?raw'
import e03 from '../../content/releases/m08-l03-exercises.md?raw'
import e04 from '../../content/releases/m08-l04-exercises.md?raw'

const lessons = [l01, l02, l03, l04, l05, l06]

describe('M08 collection and iterator release', () => {
  it('preserves six matching H1 IDs, sources and paired fences', () => {
    lessons.forEach((lesson, index) => {
      const id = `M08-L${String(index + 1).padStart(2, '0')}`
      expect(lesson).toMatch(new RegExp(`^# ${id}[： ]`))
      expect(lesson).toMatch(/^## 来源$/m)
      expect((lesson.match(/^(```|~~~)/gm) ?? []).length % 2).toBe(0)
      expect(lesson).not.toContain('预发布草稿')
    })
  })

  it('provides scenarios, exercises, and folded answers for concepts', () => {
    lessons.slice(0, 4).forEach((lesson) => {
      expect(lesson).toMatch(/^## 学习目标$/m)
      expect(lesson).toMatch(/^## 场景：/m)
      expect(lesson).toMatch(/^## 检验理解与本地练习$/m)
    })
    for (const exercise of [e01, e02, e03, e04]) {
      expect(exercise).toMatch(/^## 参考答案$/m)
    }
  })

  it('links tested Cargo projects and gives staged acceptance criteria', () => {
    for (const lab of [l05, l06]) {
      expect(lab).toMatch(/^## 分阶段验收$/m)
      expect(lab).toContain('content/samples/m08-starter')
      expect(lab).toContain('content/samples/m08-reference')
      expect(lab).toMatch(/^## 参考实现$/m)
    }
  })
})
