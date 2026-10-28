import { Fragment, useState, type JSX, type ReactNode } from 'react'
import { Check, Copy } from 'lucide-react'
import {
  resolveCourseAsset,
  resolveCourseLessonLink,
} from '../../data/courseCatalog'
import { markdownHeadingSlug } from '../../lib/markdownAnchor'
import type { Language } from '../../lib/language'

type TableAlignment = 'left' | 'center' | 'right'

const disclosureHeadings = new Set([
  '分层提示',
  '提示',
  '复盘提示',
  '参考答案',
  '参考实现',
  '参考实现要点',
  '公开答案',
  '公开参考答案',
  '公开参考实现',
  '公开练习答案',
  '案例答案与解释',
  '合同答案',
  'layered hints',
  'layering tips',
  'progressive hints',
  'tiered hints',
  'hints',
  'tips',
  'review hints',
  'review tips',
  'reference answer',
  'reference answers',
  'reference implementation',
  'reference implementation notes',
  'reference implementation points',
  'public answer',
  'public answers',
  'public reference answer',
  'public reference implementation',
  'public exercise answers',
  'case answer and explanation',
  'case answers and explanations',
  'contract answer',
])

/** Allow HTTPS references, public ZIPs, and known lesson routes. */
function safeHref(
  destination: string,
  language: Language,
): { href: string; download?: string; openInNewTab?: boolean } | undefined {
  try {
    const url = new URL(destination)
    if (url.protocol === 'https:') return { href: url.href, openInNewTab: true }
  } catch {
    // Resolve relative links only through public archive/lesson allowlists.
  }
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(destination)) return undefined
  const asset = resolveCourseAsset(destination, language)
  const fileName = destination.split(/[?#]/, 1)[0]?.split(/[\\/]/).pop()
  if (asset && fileName)
    return { href: asset, download: fileName, openInNewTab: true }
  const lessonRoute = resolveCourseLessonLink(destination, language)
  return lessonRoute ? { href: lessonRoute } : undefined
}

/** Render inline Markdown while leaving all text in React's escaped text context. */
function renderInline(markdown: string, language: Language): ReactNode[] {
  const tokenPattern = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  return markdown.split(tokenPattern).map((part, index) => {
    // Raw HTML is never passed to an HTML parser or inserted with innerHTML.
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return <code key={index}>{part.slice(1, -1)}</code>
    }
    if (part.startsWith('*') && part.endsWith('*')) {
      return <em key={index}>{part.slice(1, -1)}</em>
    }
    const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part)
    if (linkMatch) {
      const [, label, destination] = linkMatch
      const safeDestination = safeHref(destination, language)
      return safeDestination ? (
        <a
          key={index}
          href={safeDestination.href}
          target={safeDestination.openInNewTab ? '_blank' : undefined}
          rel={safeDestination.openInNewTab ? 'noopener noreferrer' : undefined}
          download={safeDestination.download}
        >
          {label}
        </a>
      ) : (
        <Fragment key={index}>{label}</Fragment>
      )
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}

/** Split a Markdown table row while preserving escaped and code-span pipes. */
function parseMarkdownTableCells(line: string): string[] | undefined {
  let source = line.trim()
  if (!source.includes('|')) return undefined
  if (source.startsWith('|')) source = source.slice(1)
  if (source.endsWith('|') && !source.endsWith('\\|'))
    source = source.slice(0, -1)

  const cells: string[] = []
  let cell = ''
  let codeDelimiterLength = 0
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === '\\' && source[index + 1] === '|') {
      cell += '|'
      index += 1
      continue
    }
    if (character === '`') {
      let delimiterLength = 1
      while (source[index + delimiterLength] === '`') delimiterLength += 1
      if (codeDelimiterLength === 0) codeDelimiterLength = delimiterLength
      else if (codeDelimiterLength === delimiterLength) codeDelimiterLength = 0
      cell += '`'.repeat(delimiterLength)
      index += delimiterLength - 1
      continue
    }
    if (character === '|' && codeDelimiterLength === 0) {
      cells.push(cell.trim())
      cell = ''
      continue
    }
    cell += character
  }
  cells.push(cell.trim())
  return cells
}

/** Convert a valid GFM separator cell into its display alignment. */
function parseTableAlignment(cell: string): TableAlignment | undefined {
  if (!/^:?-{3,}:?$/.test(cell)) return undefined
  if (cell.startsWith(':') && cell.endsWith(':')) return 'center'
  if (cell.endsWith(':')) return 'right'
  return 'left'
}

/** Keep rendered code unchanged while exposing a clear language and copy affordance. */
function CourseCodeBlock({
  code,
  syntax,
  language,
}: {
  code: string
  syntax: string
  language: Language
}): JSX.Element {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle',
  )
  const syntaxNames: Record<string, string> = {
    rust: 'Rust',
    rs: 'Rust',
    bash: 'Shell',
    sh: 'Shell',
    shell: 'Shell',
    text: 'Text',
    json: 'JSON',
    toml: 'TOML',
  }
  const syntaxLabel =
    syntaxNames[syntax.toLowerCase()] ??
    (syntax ? syntax.toUpperCase() : language === 'zh' ? '代码' : 'Code')
  const copyLabel =
    copyState === 'copied'
      ? language === 'zh'
        ? '已复制'
        : 'Copied'
      : copyState === 'failed'
        ? language === 'zh'
          ? '复制不可用'
          : 'Copy unavailable'
        : language === 'zh'
          ? '复制代码'
          : 'Copy code'

  async function copy(): Promise<void> {
    try {
      if (!navigator.clipboard?.writeText) {
        setCopyState('failed')
        return
      }
      await navigator.clipboard.writeText(code)
      setCopyState('copied')
    } catch {
      setCopyState('failed')
    }
  }

  return (
    <div className="course-code-frame">
      <div className="course-code-header">
        <span className="course-code-language">
          <span className="course-code-language-dot" aria-hidden="true" />
          {syntaxLabel}
        </span>
        <button
          type="button"
          className="course-code-copy"
          onClick={() => void copy()}
          aria-label={copyLabel}
        >
          {copyState === 'copied' ? (
            <Check size={14} aria-hidden="true" />
          ) : (
            <Copy size={14} aria-hidden="true" />
          )}
          <span aria-live="polite">{copyLabel}</span>
        </button>
      </div>
      <pre className="course-code-block">
        <code>{code}</code>
      </pre>
    </div>
  )
}

/** Parse the learner-facing Markdown blocks used by authored course material. */
function renderBlocks(
  markdown: string,
  headingOccurrences = new Map<string, number>(),
  language: Language = 'zh',
): ReactNode[] {
  const lines = markdown.split(/\r?\n/)
  const blocks: ReactNode[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line) {
      index += 1
      continue
    }

    const fence = /^(```+|~~~+)\s*([\w+-]*)/.exec(line)
    if (fence) {
      const code: string[] = []
      index += 1
      while (
        index < lines.length &&
        !new RegExp(`^\\s*${fence[1]}\\s*$`).test(lines[index])
      ) {
        code.push(lines[index])
        index += 1
      }
      if (index < lines.length) index += 1
      blocks.push(
        <CourseCodeBlock
          key={`code:${blocks.length}`}
          code={code.join('\n')}
          syntax={fence[2]}
          language={language}
        />,
      )
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const children = renderInline(heading[2], language)
      const key = `heading:${blocks.length}`
      const headingSlug = markdownHeadingSlug(heading[2])
      const occurrence = headingOccurrences.get(headingSlug) ?? 0
      headingOccurrences.set(headingSlug, occurrence + 1)
      const headingId = headingSlug
        ? occurrence === 0
          ? headingSlug
          : `${headingSlug}-${occurrence}`
        : undefined
      if (
        disclosureHeadings.has(
          heading[2]
            .trim()
            .replace(/[：:]$/, '')
            .toLowerCase(),
        )
      ) {
        const section: string[] = []
        index += 1
        while (index < lines.length) {
          const nextHeading = /^(#{1,6})\s+/.exec(lines[index].trim())
          if (nextHeading && nextHeading[1].length <= level) break
          section.push(lines[index])
          index += 1
        }
        blocks.push(
          <details className="course-markdown-disclosure" key={key}>
            <summary id={headingId}>{children}</summary>
            {renderBlocks(section.join('\n'), headingOccurrences, language)}
          </details>,
        )
        continue
      }
      if (level === 1)
        blocks.push(
          <h2 id={headingId} key={key}>
            {children}
          </h2>,
        )
      else if (level === 2)
        blocks.push(
          <h2 id={headingId} key={key}>
            {children}
          </h2>,
        )
      else if (level === 3)
        blocks.push(
          <h3 id={headingId} key={key}>
            {children}
          </h3>,
        )
      else
        blocks.push(
          <h4 id={headingId} key={key}>
            {children}
          </h4>,
        )
      index += 1
      continue
    }

    const headerCells = parseMarkdownTableCells(line)
    const separatorCells = parseMarkdownTableCells(lines[index + 1] ?? '')
    const alignments = separatorCells?.map(parseTableAlignment)
    if (
      headerCells &&
      line.includes('|') &&
      alignments?.length === headerCells.length &&
      alignments.every((alignment) => alignment !== undefined)
    ) {
      const normalizedCells = (cells: string[]): string[] =>
        Array.from(
          { length: headerCells.length },
          (_, cellIndex) => cells[cellIndex] ?? '',
        )
      const renderCells = (cells: string[], isHeader: boolean): JSX.Element[] =>
        normalizedCells(cells).map((cell, cellIndex) => {
          const style = { textAlign: alignments[cellIndex] }
          return isHeader ? (
            <th key={cellIndex} scope="col" style={style}>
              {renderInline(cell, language)}
            </th>
          ) : (
            <td key={cellIndex} style={style}>
              {renderInline(cell, language)}
            </td>
          )
        })

      const rows: string[][] = []
      index += 2
      while (
        index < lines.length &&
        lines[index].trim() &&
        lines[index].includes('|')
      ) {
        const cells = parseMarkdownTableCells(lines[index])
        if (!cells) break
        rows.push(cells)
        index += 1
      }

      const key = `table:${blocks.length}`
      blocks.push(
        <div className="course-markdown-table-wrapper" key={key}>
          <table>
            <thead>
              <tr>{renderCells(headerCells, true)}</tr>
            </thead>
            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`${key}:${rowIndex}`}>{renderCells(row, false)}</tr>
              ))}
            </tbody>
          </table>
        </div>,
      )
      continue
    }

    if (/^(---+|\*\*\*+|___+)$/.test(line)) {
      blocks.push(<hr key={`rule:${blocks.length}`} />)
      index += 1
      continue
    }

    if (line.startsWith('>')) {
      const quote: string[] = []
      while (index < lines.length && lines[index].trim().startsWith('>')) {
        quote.push(lines[index].trim().replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push(
        <blockquote key={`quote:${blocks.length}`}>
          <p>{renderInline(quote.join(' '), language)}</p>
        </blockquote>,
      )
      continue
    }

    const listMarker = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.+)$/.exec(lines[index])
    if (listMarker) {
      const baseIndent = listMarker[1].length
      const ordered = Boolean(listMarker[3])
      const start = ordered ? Number(listMarker[3]) : undefined
      const items: { text: string; continuation: string[] }[] = []
      while (index < lines.length) {
        const item = /^(\s*)(?:([-*+])|(\d+)[.)])\s+(.+)$/.exec(lines[index])
        if (
          !item ||
          item[1].length !== baseIndent ||
          Boolean(item[3]) !== ordered
        )
          break
        const continuation: string[] = []
        const contentIndent = item[0].length - item[4].length
        items.push({ text: item[4], continuation })
        index += 1
        while (index < lines.length) {
          const next = lines[index]
          if (!next.trim()) {
            // Blank lines belong to an item only when followed by indented content.
            const following = lines[index + 1]
            if (
              following &&
              /^\s+\S/.test(following) &&
              following.length - following.trimStart().length >= contentIndent
            ) {
              continuation.push('')
              index += 1
              continue
            }
            index += 1
            break
          }
          const indentation = next.length - next.trimStart().length
          if (indentation < contentIndent) break
          continuation.push(next.slice(contentIndent))
          index += 1
        }
      }
      const key = `list:${blocks.length}`
      const children = items.map(({ text, continuation }, itemIndex) => {
        const task = /^\[([ xX])\]\s+(.+)$/.exec(text)
        const additional = continuation.length
          ? renderBlocks(continuation.join('\n'), headingOccurrences, language)
          : null
        return task ? (
          <li className="course-task-list-item" key={`${key}:${itemIndex}`}>
            <label>
              <input type="checkbox" defaultChecked={task[1] !== ' '} />
              <span>{renderInline(task[2], language)}</span>
            </label>
            {additional}
          </li>
        ) : (
          <li key={`${key}:${itemIndex}`}>
            {renderInline(text, language)}
            {additional}
          </li>
        )
      })
      blocks.push(
        ordered ? (
          <ol key={key} start={start}>
            {children}
          </ol>
        ) : (
          <ul
            className={
              items.some(({ text }) => /^\[[ xX]\]\s+/.test(text))
                ? 'course-task-list'
                : undefined
            }
            key={key}
          >
            {children}
          </ul>
        ),
      )
      continue
    }

    const paragraph = [line]
    index += 1
    while (index < lines.length) {
      const next = lines[index].trim()
      if (
        !next ||
        /^(```+|~~~+|#{1,6}\s|>|---+$|\*\*\*+$|___+$)/.test(next) ||
        /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(lines[index])
      ) {
        break
      }
      paragraph.push(next)
      index += 1
    }
    blocks.push(
      <p key={`paragraph:${blocks.length}`}>
        {renderInline(paragraph.join(' '), language)}
      </p>,
    )
  }
  return blocks
}

/** Display course prose, lists, headings, quotes, and code without executing authored HTML. */
export function SafeMarkdown({
  content,
  language = 'zh',
  initialHeadingOccurrences,
}: {
  content: string
  language?: Language
  /** Reuse document-wide anchor numbering when a lesson is rendered in sections. */
  initialHeadingOccurrences?: Readonly<Record<string, number>>
}): JSX.Element {
  const learnerMarkdown = content
    .replace(
      /<(script|style|iframe|object|embed|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,
      '',
    )
    .replace(/<(?:img|input|meta|link)\b[^>]*\/?>/gi, '')
  return (
    <div className="course-markdown">
      {renderBlocks(
        learnerMarkdown,
        new Map(Object.entries(initialHeadingOccurrences ?? {})),
        language,
      )}
    </div>
  )
}
