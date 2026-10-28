import { describe, expect, it } from 'vitest'
import l01 from '../../content/releases/m05-l01.md?raw'
import l02 from '../../content/releases/m05-l02.md?raw'
import l03 from '../../content/releases/m05-l03.md?raw'
import l04 from '../../content/releases/m05-l04.md?raw'
import l05 from '../../content/releases/m05-l05.md?raw'
import l06 from '../../content/releases/m05-l06.md?raw'

const lessons = [l01, l02, l03, l04, l05, l06]

describe('M05 borrowing and text curriculum', () => {
  it('keeps IDs, references and paired code fences', () => {
    lessons.forEach((lesson, index) => {
      const id = `M05-L${String(index + 1).padStart(2, '0')}`
      expect(lesson).toMatch(new RegExp(`^# ${id}：`))
      expect(lesson).toMatch(/^## 来源$/m)
      const fences = lesson.match(/^(```|~~~)/gm) ?? []
      expect(fences.length % 2).toBe(0)
    })
  })

  it('turns concept lessons into prediction and verification tasks', () => {
    lessons.slice(0, 4).forEach((lesson) => {
      expect(lesson).toMatch(/^## 学习目标$/m)
      expect(lesson).toMatch(/^## 场景：/m)
      expect(lesson).toMatch(/^## 核心知识点一：/m)
      expect(lesson).toMatch(/^## 检验理解与本地练习$/m)
    })
  })

  it('keeps both labs self-checkable without exposing solutions', () => {
    lessons.slice(4).forEach((lesson) => {
      expect(lesson).toMatch(/^## 分层提示$/m)
      expect(lesson).toMatch(/^## 参考实现$/m)
      expect(lesson).toMatch(/^## 自查清单$/m)
    })
  })
})
