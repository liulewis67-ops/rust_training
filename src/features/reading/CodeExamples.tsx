import { useState, type JSX } from 'react'
import { Check, Code2, Copy } from 'lucide-react'
import { CodeBlock } from '../../components/CodeBlock'
import type { CodeExample } from '../../types/lesson'

/** 展示单个教学片段；仅在剪贴板实际写入后报告复制成功。 */
function ExampleCard({ example }: { example: CodeExample }): JSX.Element {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  /** 处理无剪贴板权限和不安全上下文，失败时允许用户重新尝试。 */
  async function copyCode(): Promise<void> {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(example.code)
      setStatus('copied')
    } catch {
      setStatus('failed')
    }
  }
  return (
    <div className="code-card">
      <div className="code-toolbar">
        <span>
          <i className="language-dot" />
          {example.language.toUpperCase()}{' '}
          {example.label && <em>· {example.label}</em>}
        </span>
        <button className="copy-button" onClick={copyCode}>
          {status === 'copied' ? <Check size={13} /> : <Copy size={13} />}
          {status === 'copied'
            ? '已复制'
            : status === 'failed'
              ? '复制失败，重试'
              : '复制'}
        </button>
      </div>
      <CodeBlock code={example.code} />
    </div>
  )
}

/** 复用课程示例区；原型片段未评测，不提供真实执行入口。 */
export function CodeExamples({
  examples,
}: {
  examples: CodeExample[]
}): JSX.Element {
  return (
    <section className="section-block code-section">
      <div className="section-heading">
        <span className="section-icon">
          <Code2 size={15} />
        </span>
        <div>
          <h2>代码示例</h2>
          <small>注意观察资源如何流动</small>
        </div>
      </div>
      {examples.map((example) => {
        // 示例内容在本课程版本内固定，用语言和正文区分身份。
        return (
          <ExampleCard
            key={`${example.language}:${example.code}`}
            example={example}
          />
        )
      })}
    </section>
  )
}
