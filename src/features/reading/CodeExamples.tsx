import type { JSX } from 'react'
import { Code2 } from 'lucide-react'
import { CodeBlock } from '../../components/CodeBlock'
import type { CodeExample } from '../../types/lesson'
import './CodeExamples.css'

/** Present public course examples for copying into a local Rust project. */
export function CodeExamples({
  examples,
}: {
  examples: CodeExample[]
  lessonId?: string
}): JSX.Element {
  return (
    <section className="section-block code-section">
      <div className="section-heading">
        <span className="section-icon">
          <Code2 size={15} />
        </span>
        <div>
          <h2>代码示例</h2>
          <small>复制示例，在本地项目中阅读和修改</small>
        </div>
      </div>
      {examples.map((example, index) => (
        <article
          className="code-card"
          key={`${example.label ?? example.language}:${index}`}
        >
          <div className="code-toolbar">
            <span>
              <i className="language-dot" />
              {example.language.toUpperCase()}{' '}
              {example.label && <em>· {example.label}</em>}
            </span>
          </div>
          <CodeBlock code={example.code} />
        </article>
      ))}
    </section>
  )
}
