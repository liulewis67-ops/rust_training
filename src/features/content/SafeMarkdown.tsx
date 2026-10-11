import { Fragment, type JSX, type ReactNode } from 'react'

/** Remove raw HTML before parsing a deliberately small Markdown subset. */
function removeHtml(markdown: string): string {
  return markdown
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(
      /<(script|style|iframe|object|embed|svg|math)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      '',
    )
    .replace(/<\/?[a-z][^>]*>/gi, '')
}

/** Allow only absolute HTTPS destinations for links authored in course text. */
function safeHref(destination: string): string | undefined {
  try {
    const url = new URL(destination)
    return url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

/** Render plain text, emphasis, inline code and HTTPS links as React nodes. */
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
      const href = safeHref(destination)
      return href ? (
        <a key={index} href={href} target="_blank" rel="noopener noreferrer">
          {label}
        </a>
      ) : (
        <Fragment key={index}>{label}</Fragment>
      )
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}

/** Display course prose without allowing embedded HTML or executable URL schemes. */
export function SafeMarkdown({ content }: { content: string }): JSX.Element {
  const paragraphs = removeHtml(content)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
  return (
    <div className="course-markdown">
      {paragraphs.map((paragraph, index) => {
        // Keep paragraph boundaries while rendering only the supported safe inline tokens.
        return <p key={index}>{renderInline(paragraph)}</p>
      })}
    </div>
  )
}
