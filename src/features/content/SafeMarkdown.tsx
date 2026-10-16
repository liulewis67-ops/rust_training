import { Fragment, type JSX, type ReactNode } from 'react'
import { resolveCourseAsset } from '../../data/courseCatalog'

/** Allow HTTPS references and ZIP archives selected from the public lesson asset folder. */
function safeHref(
  destination: string,
): { href: string; download: boolean } | undefined {
  try {
    const url = new URL(destination)
    if (url.protocol === 'https:') return { href: url.href, download: false }
  } catch {
    // Resolve relative lesson links only through the explicit public ZIP allowlist.
  }
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(destination)) return undefined
  const asset = resolveCourseAsset(destination)
  return asset ? { href: asset, download: true } : undefined
}

/** Render inline Markdown while leaving all text in React's escaped text context. */
function renderInline(markdown: string): ReactNode[] {
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
      const safeDestination = safeHref(destination)
      return safeDestination ? (
        <a
          key={index}
          href={safeDestination.href}
          target="_blank"
          rel="noopener noreferrer"
          download={safeDestination.download || undefined}
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

/** Parse the learner-facing Markdown blocks used by authored course material. */
function renderBlocks(markdown: string): ReactNode[] {
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
        <pre className="course-code-block" key={`code:${blocks.length}`}>
          <code>{code.join('\n')}</code>
        </pre>,
      )
      continue
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      const children = renderInline(heading[2])
      const key = `heading:${blocks.length}`
      if (/^(?:分层提示|参考答案|参考实现)(?:[：:\s]|$)/.test(heading[2])) {
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
            <summary>{children}</summary>
            {renderBlocks(section.join('\n'))}
          </details>,
        )
        continue
      }
      if (level === 1) blocks.push(<h2 key={key}>{children}</h2>)
      else if (level === 2) blocks.push(<h2 key={key}>{children}</h2>)
      else if (level === 3) blocks.push(<h3 key={key}>{children}</h3>)
      else blocks.push(<h4 key={key}>{children}</h4>)
      index += 1
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
          <p>{renderInline(quote.join(' '))}</p>
        </blockquote>,
      )
      continue
    }

    const listMarker = /^\s*(?:([-*+])|(\d+)[.)])\s+/.exec(lines[index])
    if (listMarker) {
      const ordered = Boolean(listMarker[2])
      const items: string[] = []
      while (index < lines.length) {
        const item = /^\s*(?:([-*+])|(\d+)[.)])\s+(.+)$/.exec(lines[index])
        if (!item || Boolean(item[2]) !== ordered) break
        items.push(item[3])
        index += 1
      }
      const key = `list:${blocks.length}`
      const children = items.map((item, itemIndex) => (
        <li key={`${key}:${itemIndex}`}>{renderInline(item)}</li>
      ))
      blocks.push(
        ordered ? <ol key={key}>{children}</ol> : <ul key={key}>{children}</ul>,
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
        {renderInline(paragraph.join(' '))}
      </p>,
    )
  }
  return blocks
}

/** Display course prose, lists, headings, quotes, and code without executing authored HTML. */
export function SafeMarkdown({ content }: { content: string }): JSX.Element {
  const learnerMarkdown = content
    .replace(
      /<(script|style|iframe|object|embed|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi,
      '',
    )
    .replace(/<(?:img|input|meta|link)\b[^>]*\/?>/gi, '')
  return <div className="course-markdown">{renderBlocks(learnerMarkdown)}</div>
}
