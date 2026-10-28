import { expect, it } from 'vitest'
import { organizeLessonMarkdown } from './lessonStructure'

it('groups preparation, concepts, practice and sources', () => {
  const sections = organizeLessonMarkdown(
    [
      '## 学完后',
      '- 解释所有权',
      '## 借用概念',
      '示例。',
      '## 第二个知识点',
      '继续。',
      '## 检查顺序',
      '本地核对。',
      '## 来源',
      '- Rust Book',
    ].join('\n\n'),
  )
  expect(sections.map(({ kind, step }) => [kind, step])).toEqual([
    ['prepare', null],
    ['concept', 1],
    ['concept', 2],
    ['apply', null],
    ['reference', null],
  ])
})

it('treats curriculum checkpoints as practice rather than concepts', () => {
  const sections = organizeLessonMarkdown(
    [
      '## 学习目标',
      '目标。',
      '## 核心知识点一：所有权',
      '讲解。',
      '## 检验理解',
      '预测。',
      '## 分阶段验收',
      '验收。',
      '## 自查清单',
      '核查。',
      '## 参考实现',
      '答案。',
      '## 来源',
      'Rust Book。',
    ].join('\n\n'),
  )
  expect(sections.map(({ kind, step }) => [kind, step])).toEqual([
    ['prepare', null],
    ['concept', 1],
    ['apply', null],
    ['apply', null],
    ['apply', null],
    ['apply', null],
    ['reference', null],
  ])
})

it('does not split on Markdown headings inside Rust code fences', () => {
  const sections = organizeLessonMarkdown(
    [
      '## 基础',
      '```rust',
      '## not a heading',
      'fn main() {}',
      '```',
      '## 下一节',
      '内容',
    ].join('\n'),
  )
  expect(sections).toHaveLength(2)
  expect(sections[0].markdown).toContain('## not a heading')
})

it('preserves repeated anchors when rendering lesson segments', () => {
  const sections = organizeLessonMarkdown(
    ['## 概念', '### 同名', '## 概念', '### 同名'].join('\n'),
  )
  expect(sections.map(({ id }) => id)).toEqual(['概念', '概念-1'])
  expect(sections[1].headingOccurrences['同名']).toBe(1)
  expect(sections[1].headingOccurrences['概念']).toBe(1)
})
