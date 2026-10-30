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
  'm01-l01',
  'm02-l02',
  'm03-l02',
  'm04-l02',
  'm05-l03',
  'm06-l05',
  'm07-l03',
  'm07-l05',
  'm08-l05',
  'm09-l03',
  'm09-l05',
]

function checkExample(page: string, first: string, last: string): void {
  expect(page).toContain(first)
  expect(page).toContain(last)
  const code = page.search(/^`{3,}rust|^~{3,}rust/m)
  expect(code).toBeGreaterThan(0)
  expect(page.indexOf(first)).toBeLessThan(code)
  expect(page.indexOf(last)).toBeGreaterThan(code)
}

describe('bilingual Rust examples explain predictions and observations', () => {
  it.each(reviewed)('%s annotates its first code example', (id) => {
    const zh = chinese[`../../content/releases/${id}.md`]
    const en = english[`../../content/releases/en/${id}.md`]
    checkExample(zh, '**阅读代码前先预测：**', '**运行或编译后观察：**')
    checkExample(
      en,
      '**Before reading this snippet:**',
      '**After running or inspecting it:**',
    )
  })
})
