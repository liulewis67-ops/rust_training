import { expect, it } from 'vitest'
import {
  lessonSupplementKind,
  organizeLessonMarkdown,
} from './lessonStructure'

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

it('moves verification matrices, solutions and sources out of the article flow', () => {
  const headings = [
    ['场景与交付契约', null],
    ['原理推导与反例辨析：处理单位与溢出', null],
    ['实验步骤', null],
    ['实证化实验验收', 'validation'],
    ['独立毕业验收：非学生起始断言', 'validation'],
    ['自查清单', 'validation'],
    ['分层提示', 'hints'],
    ['参考实现', 'answers'],
    ['进阶：确定性模型差分与检错能力', 'advanced'],
    ['反例最小化与测试覆盖矩阵', 'advanced'],
    ['弱关联反例、数值/语法收缩与等价审查', 'advanced'],
    ['来源', 'sources'],
    ['Scenario and delivery contract', null],
    ['Staged acceptance', 'validation'],
    ['Progressive hints', 'hints'],
    ['Reference implementation', 'answers'],
    ['Advanced: seeded differential models and mutation sensitivity', 'advanced'],
    ['Sources', 'sources'],
  ] as const
  for (const [heading, expected] of headings) {
    expect(lessonSupplementKind(heading)).toBe(expected)
  }
})

it('retains all authored H2 headings and anchor occurrences after grouping', () => {
  const content = [
    '## 场景',
    '以一个重复键为例。',
    '## 分层提示',
    '第一层提示。',
    '## 参考实现',
    '### 内部约束',
    '参考代码。',
    '## 反例最小化与测试覆盖矩阵',
    '高级证据。',
    '## 场景',
    '复盘。',
  ].join('\n\n')
  const sections = organizeLessonMarkdown(content)
  expect(sections).toHaveLength(5)
  expect(sections.map((s) => s.id)).toEqual([
    '场景',
    '分层提示',
    '参考实现',
    '反例最小化与测试覆盖矩阵',
    '场景-1',
  ])
  expect(sections.filter((s) => lessonSupplementKind(s.title))).toHaveLength(3)
  expect(sections[4].headingOccurrences['场景']).toBe(1)
})
