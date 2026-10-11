import type { JSX } from 'react'
import { BookOpen, FileCheck2, ShieldCheck } from 'lucide-react'
import coursePack from '../../content/borrowed-text.course.json'
import runnableExample from '../../content/samples/first-word-runnable.rs?raw'
import fragmentExample from '../../content/samples/first-word-fragment.rs?raw'
import compileFailExample from '../../content/samples/borrow-conflict-compile-fail.rs?raw'
import { CodeBlock } from '../components/CodeBlock'
import { SafeMarkdown } from '../features/content/SafeMarkdown'

const lesson = coursePack.lessons[0]
const exercise = coursePack.exercises[0]

/** Render only examples explicitly whitelisted by this public lesson version. */
const publicExamples = [
  {
    id: 'first-word-runnable',
    title: '完整可运行示例',
    status: '已通过固定 Rust 工具链校验',
    code: runnableExample,
  },
  {
    id: 'first-word-fragment',
    title: '教学片段（不可运行）',
    status: '依赖课程上下文，不显示运行操作',
    code: fragmentExample,
  },
  {
    id: 'borrow-conflict-compile-fail',
    title: '预期编译失败 · E0502',
    status: '校验目标是借用冲突诊断',
    code: compileFailExample,
  },
]

/** Preview the authored course package without creating learner progress or exposing private assessment data. */
export function CoursePreviewPage(): JSX.Element {
  const selectedExamples = publicExamples.filter((example) => {
    // Only include source IDs listed by the public lesson package.
    return lesson.example_ids.includes(example.id)
  })

  return (
    <article className="course-preview">
      <p className="preview-status">
        <ShieldCheck size={15} />
        本地作者预览 · 未发布 · 不计入学习进度
      </p>
      <header className="preview-heading">
        <span>
          {coursePack.course_id} · v{coursePack.version} ·{' '}
          {coursePack.environment.rust_version}
        </span>
        <h1>{coursePack.title}</h1>
        <h2>{lesson.title}</h2>
        <p>{lesson.objectives.join('；')}</p>
      </header>

      <section className="preview-section">
        <h2>
          <BookOpen size={16} /> 课程正文
        </h2>
        {lesson.blocks.map((block, index) => {
          // Block text is rendered through the safe Markdown subset, never as raw HTML.
          return (
            <SafeMarkdown key={`${block.type}:${index}`} content={block.text} />
          )
        })}
      </section>

      <section className="preview-section">
        <h2>
          <FileCheck2 size={16} /> 代码示例
        </h2>
        {selectedExamples.map((example) => {
          // Public source selection is controlled by the lesson's example ID list.
          return (
            <section className="preview-example" key={example.id}>
              <div className="preview-example-heading">
                <div>
                  <h3>{example.title}</h3>
                  <small>{example.status}</small>
                </div>
                <span>Rust</span>
              </div>
              <CodeBlock code={example.code} />
            </section>
          )
        })}
      </section>

      <section className="preview-section preview-exercise">
        <h2>练习预览</h2>
        <p>{exercise.prompt}</p>
        <details open>
          <summary>分层提示</summary>
          <ol>
            {exercise.hints.map((hint, index) => {
              // Hints are public course content and remain separate from private answers.
              return <li key={`${index}:${hint}`}>{hint}</li>
            })}
          </ol>
        </details>
      </section>

      <section className="preview-section">
        <h2>来源与版本</h2>
        <ul className="preview-sources">
          {coursePack.sources.map((source) => {
            // Display provenance metadata from the public course package.
            return (
              <li key={source.id}>
                <a href={source.url} target="_blank" rel="noopener noreferrer">
                  {source.author}
                </a>
                <span>{source.revision}</span>
                <small>
                  {source.accessed_at} · {source.license_status}
                </small>
              </li>
            )
          })}
        </ul>
      </section>
    </article>
  )
}
