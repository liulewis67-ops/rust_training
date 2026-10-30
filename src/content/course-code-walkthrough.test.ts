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

const reviewed = [
  'm01-l01', 'm02-l02', 'm03-l02', 'm04-l02', 'm05-l03',
  'm06-l05', 'm07-l03', 'm07-l05', 'm08-l05', 'm09-l03', 'm09-l05',
]

describe('bilingual Rust examples have a reason to run and an observation', () => {
  it.each(reviewed)('%s includes surrounding code-reading commentary', (id) => {
    const zh = chinese[`../../content/releases/${id}.md`]
    const en = english[`../../content/releases/en/${id}.md`]
    for (const [page, first, last] of [
      [zh, '**阅读代码前先预测：**', '**运行或编译后观察：**'],
      [en, '**Before reading this snippet:**', '**After running or inspecting it:**'],
    ] as const) {
      expect(page).toContain(first)
      expect(page).toContain(last)
      const pos = page.search(/^`{3,}rust|^~{3,}rust/m)
      expect(pos).toBeGreaterThan(0)
      expect(page.indexOf(first)).toBeLessThan(pos)
      expect(page.indexOf(last)).toBeGreaterThan(pos)
    }
  })
})
