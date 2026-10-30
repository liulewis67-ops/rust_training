import { describe, expect, it } from 'vitest'
import l01 from '../../content/releases/m03-l01.md?raw'
import l02 from '../../content/releases/m03-l02.md?raw'
import l03 from '../../content/releases/m03-l03.md?raw'
import l04 from '../../content/releases/m03-l04.md?raw'
import l05 from '../../content/releases/m03-l05.md?raw'
import l06 from '../../content/releases/m03-l06.md?raw'

const lessons = [l01, l02, l03, l04, l05, l06]

describe('M03 domain modeling curriculum', () => {
  it('preserves lesson IDs and references', () => {
    lessons.forEach((lesson, index) => {
      const id = `M03-L${String(index + 1).padStart(2, '0')}`
      expect(lesson).toMatch(new RegExp(`^# ${id}：`))
      expect(lesson).toMatch(/^## 来源$/m)
      expect((lesson.match(/^```/gm) ?? []).length % 2).toBe(0)
    })
  })

  it('adds a learning goal and exercise check to each concept lesson', () => {
    lessons.slice(0, 4).forEach((lesson) => {
      expect(lesson).toMatch(/^## 学习目标$/m)
      expect(lesson).toMatch(/^## 场景：/m)
      expect(lesson).toMatch(/^## 原理推导与反例辨析/m)
      expect(lesson).toMatch(/^## 检验理解与本地练习$/m)
    })
  })

  it('keeps lab hints and full solutions behind disclosure titles', () => {
    lessons.slice(4).forEach((lesson) => {
      expect(lesson).toMatch(/^## 分层提示$/m)
      expect(lesson).toMatch(/^## (?:公开)?参考实现$/m)
      expect(lesson).toMatch(/^## 自查清单$/m)
    })
  })
})
