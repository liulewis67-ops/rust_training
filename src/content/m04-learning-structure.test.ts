import { describe, expect, it } from 'vitest'
import l01 from '../../content/releases/m04-l01.md?raw'
import l02 from '../../content/releases/m04-l02.md?raw'
import l03 from '../../content/releases/m04-l03.md?raw'
import l04 from '../../content/releases/m04-l04.md?raw'
import l05 from '../../content/releases/m04-l05.md?raw'
import l06 from '../../content/releases/m04-l06.md?raw'

const lessons = [l01, l02, l03, l04, l05, l06]

describe('M04 ownership module', () => {
  it('keeps objectives, unique IDs, sources and code fences', () => {
    lessons.forEach((lesson, index) => {
      const id = `M04-L${String(index + 1).padStart(2, '0')}`
      expect(lesson).toMatch(new RegExp(`^# ${id}：`))
      expect(lesson).toMatch(/^## 来源$/m)
      expect((lesson.match(/^```/gm) ?? []).length % 2).toBe(0)
    })
  })

  it('introduces ownership concepts and prediction checkpoints', () => {
    lessons.slice(0, 4).forEach((lesson) => {
      expect(lesson).toMatch(/^## 学习目标$/m)
      expect(lesson).toMatch(/^## 场景：/m)
      expect(lesson).toMatch(/^## 原理推导与反例辨析/m)
      expect(lesson).toMatch(/^## 检验理解$/m)
    })
  })

  it('retains gated lab solutions and checks', () => {
    lessons.slice(4).forEach((lesson) => {
      expect(lesson).toMatch(/^## 自查清单$/m)
      expect(lesson).toMatch(/^## 参考实现$/m)
    })
    expect(l05).toMatch(/^## 分层提示$/m)
  })
})
