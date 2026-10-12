import { useEffect, useState, type CSSProperties, type JSX } from 'react'
import { Check, Code2, Copy } from 'lucide-react'
import { CodeBlock } from '../../components/CodeBlock'
import { DraftEditor } from '../workspace/DraftEditor'
import type { CodeExample } from '../../types/lesson'
import { readStoredValue, writeStoredValue } from '../../lib/browserStorage'
import './CodeExamples.css'

const SPLIT_LAYOUT_KEY = 'rust-backend-training:code-split-layout'
const SPLIT_RATIO_KEY = 'rust-backend-training:code-split-ratio'

/** Restore a bounded pane ratio; malformed or unavailable storage uses an even split. */
function readSplitRatio(): number {
  const result = readStoredValue(SPLIT_RATIO_KEY)
  const parsed = result.ok && result.value ? Number(result.value) : Number.NaN
  return Number.isFinite(parsed) ? Math.min(65, Math.max(35, parsed)) : 50
}

/** 展示单个教学片段；仅在剪贴板实际写入后报告复制成功。 */
function ExampleCard({
  example,
  lessonId,
  index,
  splitLayout,
}: {
  example: CodeExample
  lessonId: string
  index: number
  splitLayout: boolean
}): JSX.Element {
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
    <div className={`code-card ${splitLayout ? 'code-card-split' : ''}`}>
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
              : '复制原始示例'}
        </button>
      </div>
      <CodeBlock code={example.code} />
      <DraftEditor
        lessonId={lessonId}
        itemId={example.label ?? `${example.language}-${index + 1}`}
        template={example.code}
        label={example.label ?? `示例 ${index + 1}`}
      />
    </div>
  )
}

/** 复用课程示例区；原型片段未评测，不提供真实执行入口。 */
export function CodeExamples({
  examples,
  lessonId,
}: {
  examples: CodeExample[]
  lessonId: string
}): JSX.Element {
  const [splitLayout, setSplitLayout] = useState(() => {
    const result = readStoredValue(SPLIT_LAYOUT_KEY)
    return result.ok && result.value === 'true'
  })
  const [splitRatio, setSplitRatio] = useState(readSplitRatio)
  useEffect(() => {
    // Layout preferences improve reading but never affect saved learning records.
    writeStoredValue(SPLIT_LAYOUT_KEY, String(splitLayout))
  }, [splitLayout])
  useEffect(() => {
    // Keep the user's desktop pane width when storage is available.
    writeStoredValue(SPLIT_RATIO_KEY, String(splitRatio))
  }, [splitRatio])
  const layoutStyle = {
    '--code-pane-ratio': `${splitRatio}%`,
  } as CSSProperties
  return (
    <section className="section-block code-section" style={layoutStyle}>
      <div className="section-heading">
        <span className="section-icon">
          <Code2 size={15} />
        </span>
        <div>
          <h2>代码示例</h2>
          <small>按 Tab 在示例工具与编辑器间移动焦点</small>
        </div>
        <div className="code-layout-controls">
          <button
            type="button"
            className="secondary-button code-layout-toggle"
            aria-pressed={splitLayout}
            onClick={() => {
              // Toggle the desktop split view without changing the source example.
              setSplitLayout((active) => !active)
            }}
          >
            {splitLayout ? '上下排列' : '并排阅读与编辑'}
          </button>
          <label>
            <span>分栏比例</span>
            <input
              type="range"
              min="35"
              max="65"
              step="5"
              value={splitRatio}
              aria-label="代码与编辑器分栏比例"
              onChange={(event) => {
                // Limit resizing to a range that keeps both panes readable.
                setSplitRatio(Number(event.currentTarget.value))
              }}
            />
          </label>
        </div>
      </div>
      <p className="code-layout-hint" role="status" aria-live="polite">
        {splitLayout
          ? '并排模式：左侧为课程示例，右侧为可编辑草稿。窄屏会自动改为上下排列。'
          : '上下模式：课程示例和可编辑草稿依次显示。'}
      </p>
      {examples.map((example, index) => {
        // 示例内容在本课程版本内固定，用语言和正文区分身份。
        return (
          <ExampleCard
            key={`${lessonId}:${example.label ?? index}`}
            example={example}
            lessonId={lessonId}
            index={index}
            splitLayout={splitLayout}
          />
        )
      })}
    </section>
  )
}
