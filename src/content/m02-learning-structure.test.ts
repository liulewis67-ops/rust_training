import { describe, expect, it } from 'vitest'
import l01 from '../../content/releases/m02-l01.md?raw'
import l02 from '../../content/releases/m02-l02.md?raw'
import l03 from '../../content/releases/m02-l03.md?raw'
import l04 from '../../content/releases/m02-l04.md?raw'
import l05 from '../../content/releases/m02-l05.md?raw'
import l06 from '../../content/releases/m02-l06.md?raw'

const lessons = [l01, l02, l03, l04, l05, l06]

describe('M02 guided lessons', () => {
  it('preserves six published lessons and safe code fences', () => {
    lessons.forEach((lesson, index) => {
      const id = `M02-L${String(index + 1).padStart(2, '0')}`
      expect(lesson).toMatch(new RegExp(`^# ${id}：`))
      expect(lesson).toMatch(/^## 来源$/m)
      expect((lesson.match(/^```/gm) ?? []).length % 2).toBe(0)
    })
  })

  it('structures concept lessons for prediction and practice', () => {
    lessons.slice(0, 4).forEach((lesson) => {
      expect(lesson).toMatch(/^## 学习目标$/m)
      expect(lesson).toMatch(/^## 场景：/m)
      expect(lesson).toMatch(/^## 原理推导与反例辨析/m)
      expect(lesson).toMatch(/^## 检验理解/m)
      expect(lesson).toMatch(/^## 本地练习$/m)
      expect(lesson).toMatch(/Java\s*\/\s*Go/)
    })
  })

  it('retains lab checkpoints and folded answers', () => {
    lessons.slice(4).forEach((lesson) => {
      expect(lesson).toMatch(/^## 分层提示$/m)
      expect(lesson).toMatch(/^## (?:公开)?参考实现$/m)
      expect(lesson).toMatch(/^## 自查清单$/m)
      const hints = lesson.indexOf('\n## 分层提示\n')
      expect(lesson.indexOf('参考实现', hints)).toBeGreaterThan(hints)
    })
  })
})
