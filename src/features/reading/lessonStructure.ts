import { markdownHeadingSlug } from '../../lib/markdownAnchor'

export type LessonSectionKind = 'prepare' | 'concept' | 'apply' | 'reference'

export type LessonSupplementKind =
  | 'validation'
  | 'hints'
  | 'answers'
  | 'advanced'
  | 'sources'

/**
 * Editorial reading layout, independent of the authored Markdown order.
 * Keep contract/steps in the article; expose detailed evidence and answers on demand.
 */
export function lessonSupplementKind(
  title: string | null,
): LessonSupplementKind | null {
  if (!title) return null
  const heading = title.trim()
  if (
    /^(来源|参考资料|延伸阅读|sources|references|further reading)/i.test(
      heading,
    )
  )
    return 'sources'
  if (
    /^(分层提示|提示|复盘提示|layered hints|layering tips|progressive hints|tiered hints|hints|review hints|review tips)/i.test(
      heading,
    )
  )
    return 'hints'
  if (
    /^(参考实现|参考答案|公开答案|公开参考|公开练习答案|案例答案|合同答案|reference implementation|reference answer|public answer|public reference|public exercise answers|case answers?|contract answer)/i.test(
      heading,
    )
  )
    return 'answers'
  if (
    /^(进阶|对抗式|反例最小化|弱关联|advanced|adversarial|counterexample shrinking|mutation matrix|weak association|weak-link)/i.test(
      heading,
    )
  )
    return 'advanced'
  if (
    /^(实证化实验验收|独立交付与边界验收|独立毕业验收|分阶段验收|自查清单|自查用例|检验理解|公开检查|公开测试|起始快照中的预期故障|重置与验收边界|重置与发布边界|完成与重置|提交证据|提交时附带说明|实证化|evidence-based acceptance|independent delivery|independent graduation|graduation acceptance|staged acceptance|self-check|self-test|public checks|public test|reset and|completion and reset|submission evidence|evidence to submit|check your understanding)/i.test(
      heading,
    )
  )
    return 'validation'
  return null
}

export interface ReadingSection {
  title: string | null
  markdown: string
  id: string | null
  kind: LessonSectionKind
  step: number | null
  /** Heading counts preceding this segment, so links stay stable when rendered separately. */
  headingOccurrences: Record<string, number>
}

/** Group navigation into learning preparation, concepts, practice and sources. */
function sectionKind(title: string | null): LessonSectionKind {
  if (
    !title ||
    /^(先修|学习目标|学完后|学习前|实验目标|prerequisites|learning objectives|learning goals|after this lesson|get the starter|get and run locally|lab objectives|工程推进|engineering thread)/i.test(
      title,
    )
  ) {
    return 'prepare'
  }
  if (
    /^(来源|参考资料|延伸阅读|sources|references|further reading)/i.test(title)
  ) {
    return 'reference'
  }
  if (
    /^(本地练习|练习|检验理解|检验|实践|实验|检查|自查|分阶段验收|先预测|代码验证|本地操作|公开检查|公开参考|参考实现|起点与观察|完成与重置|提交说明|重置与验收|任务|独立任务|公开行为契约|行为契约|分层提示|提示|复盘|自测|本节小结|任务拆解|分阶段|训练|分层|设计检查|local practice|practice|exercise|lab|check|review|summary|hints|progressive hints|staged acceptance|self-check|work through the lab|predict before implementing|predict unicode|fixed presentation contract|input and output contract|design notes to submit|publication and environment|reset and publication boundary|assessment instructions)/i.test(
      title,
    )
  ) {
    return 'apply'
  }
  return 'concept'
}

/**
 * Group an authored Markdown lesson by its real H2 headings, not by character counts.
 * Fenced Rust code may contain heading-like strings and must never be split.
 * Track every heading level to reproduce SafeMarkdown's repeated-heading IDs.
 */
export function organizeLessonMarkdown(markdown: string): ReadingSection[] {
  const lines = markdown.split(/\r?\n/)
  const sections: ReadingSection[] = []
  const headingCounts = new Map<string, number>()
  let currentLines: string[] = []
  let title: string | null = null
  let id: string | null = null
  let before: Record<string, number> = {}
  let fence: { char: string; length: number } | null = null
  let conceptStep = 0

  function pushSection(): void {
    const body = currentLines.join('\n').trim()
    if (!body) return
    const kind = sectionKind(title)
    if (kind === 'concept') conceptStep += 1
    sections.push({
      title,
      markdown: body,
      id,
      kind,
      step: kind === 'concept' ? conceptStep : null,
      headingOccurrences: before,
    })
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const delimiter = /^(`{3,}|~{3,})/.exec(trimmed)
    if (fence) {
      currentLines.push(line)
      if (
        delimiter &&
        delimiter[1][0] === fence.char &&
        delimiter[1].length >= fence.length &&
        trimmed.slice(delimiter[1].length).trim() === ''
      ) {
        fence = null
      }
      continue
    }
    if (delimiter) {
      fence = { char: delimiter[1][0], length: delimiter[1].length }
      currentLines.push(line)
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(trimmed)
    if (heading) {
      const slug = markdownHeadingSlug(heading[2])
      const occurrence = headingCounts.get(slug) ?? 0
      if (heading[1].length === 2) {
        pushSection()
        title = heading[2]
        id = slug ? (occurrence === 0 ? slug : `${slug}-${occurrence}`) : null
        currentLines = []
        before = Object.fromEntries(headingCounts)
      }
      headingCounts.set(slug, occurrence + 1)
    }
    currentLines.push(line)
  }

  pushSection()
  return sections
}
