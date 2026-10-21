import { useState, type JSX } from 'react'
import { useLanguage } from '../lib/language'

/** 按行显示代码文本；通过 React 转义内容，不注入 HTML。 */
export function CodeBlock({
  code,
  compact = false,
}: {
  code: string
  compact?: boolean
}): JSX.Element {
  const { t } = useLanguage()
  const [copyStatus, setCopyStatus] = useState('')

  /** Copy this public example for practice in the learner's local project. */
  async function copyCode(): Promise<void> {
    try {
      await navigator.clipboard.writeText(code)
      setCopyStatus(
        t(
          '已复制，可粘贴到本地项目',
          'Copied. Paste it into your local project.',
        ),
      )
    } catch {
      setCopyStatus(
        t(
          '复制失败，请手动选中代码复制',
          'Copy failed. Select and copy the code manually.',
        ),
      )
    }
  }

  return (
    <div className="code-example">
      <div className="code-example-actions">
        <button type="button" className="text-button" onClick={copyCode}>
          {t('复制代码', 'Copy code')}
        </button>
        <span role="status">{copyStatus}</span>
      </div>
      <pre className={`code-pre ${compact ? 'compact-code' : ''}`}>
        <code>
          {code.split('\n').map((line, i) => {
            // 为固定代码片段生成行号和高亮内容。
            return (
              <span className="code-line" key={i}>
                <i>{String(i + 1).padStart(2, '0')}</i>
                <span>{highlight(line)}</span>
              </span>
            )
          })}
        </code>
      </pre>
    </div>
  )
}
/** 对教学片段作轻量语法着色，所有未知内容仍作为文本输出。 */
function highlight(line: string): React.ReactNode {
  if (line.trim().startsWith('//'))
    return <span className="syntax-comment">{line}</span>
  const chunks = line.split(
    /(\b(?:let|fn|struct|trait|impl|mut|pub|async|await|return|if|else|Result|String|self|true|false)\b|"[^"]*")/g,
  )
  return chunks.map((part, i) => {
    // 区分字符串、关键字和类型，其余内容保持原样。
    return part.startsWith('"') ? (
      <span key={i} className="syntax-string">
        {part}
      </span>
    ) : /^(let|fn|struct|trait|impl|mut|pub|async|await|return|if|else)$/.test(
        part,
      ) ? (
      <span key={i} className="syntax-keyword">
        {part}
      </span>
    ) : /^(Result|String|self|true|false)$/.test(part) ? (
      <span key={i} className="syntax-type">
        {part}
      </span>
    ) : (
      part
    )
  })
}
