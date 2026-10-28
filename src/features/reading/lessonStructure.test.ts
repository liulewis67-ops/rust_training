import { expect, it } from 'vitest'
import { organizeLessonMarkdown } from './lessonStructure'

it('organizes a lesson into preparation, numbered concepts, practice and sources', () => {
  const sections = organizeLessonMarkdown([
    '## 学完后', '- 解释所有权',
    '## 借用概念', '示例。',
    '## 第二个知识点', '继续。',
    '## 检查顺序', '本地核对。',
    '## 来源', '- Rust Book',
  ].join('\n\n'))
  expect(sections.map(({ kind, step }) => [kind, step])).toEqual([
    ['prepare', null], ['concept', 1], ['concept', 2],
    ['apply', null], ['reference', null],
  ])
})

it('does not mistake Markdown headings inside Rust code fences for sections', () => {
  const sections = organizeLessonMarkdown([
    '## 基础',
    '```rust',
    '## not a heading',
    'fn main() {}',
    '```',
    '## 下一节',
    '内容',
  ].join('\n'))
  expect(sections).toHaveLength(2)
  expect(sections[0].markdown).toContain('## not a heading')
})

it('preserves duplicate heading anchors across independently rendered sections', () => {
  const sections = organizeLessonMarkdown([
    '## 概念',
    '### 同名',
    '## 概念',
    '### 同名',
  ].join('\n'))
  expect(sections.map(({ id }) => id)).toEqual(['概念', '概念-1'])
  expect(sections[1].headingOccurrences['同名']).toBe(1)
  expect(sections[1].headingOccurrences['概念']).toBe(1)
})
