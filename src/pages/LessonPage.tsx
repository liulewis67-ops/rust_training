import type { JSX } from 'react'
import { useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
} from 'lucide-react'
import { lessons, tagLabel, difficultyLabel } from '../features/catalog'
import { ChoiceExercise, OpenExercise } from '../features/practice'
import { CodeExamples } from '../features/reading'
import { CodeBlock } from '../components/CodeBlock'
import type { Progress } from '../features/learning'
import type { Lesson, Exercise } from '../types/lesson'
import './lessonReflection.css'

/** 组合课程正文、示例和练习；将状态变更交给学习模块。 */
export function LessonPage({
  lesson,
  progress,
  exercises,
  onAttempt,
  onComplete,
  onNavigate,
  onReview,
}: {
  lesson: Lesson
  progress: Progress
  exercises: Exercise[]
  onAttempt: (
    exercise: Exercise,
    answer: string | number,
    correct: boolean,
    score?: number,
  ) => void
  onComplete: () => void
  onNavigate: (lesson: Lesson) => void
  onReview: () => void
}): JSX.Element {
  const [activeExercise, setActiveExercise] = useState(0)
  const done = progress.completed.includes(lesson.id)
  const exercise = exercises[activeExercise]
  const allAnswered =
    exercises.length > 0 &&
    exercises.every((item) => {
      // 检查本课每道题是否已有本地作答。
      return progress.attempts.some((attempt) => {
        // 按原题 ID 匹配历史记录。
        return attempt.exerciseId === item.id
      })
    })
  const existing = progress.attempts.find((item) => {
    // 恢复当前练习的已有答案。
    return item.exerciseId === exercise?.id
  })
  return (
    <>
      <div className="lesson-heading">
        <div className="breadcrumb">
          <span>Rust Backend Path</span>
          <ChevronRight size={13} />
          <span>{lesson.category}</span>
        </div>
        <div className="lesson-meta">
          <span className="lesson-index">
            LESSON {String(lesson.order).padStart(2, '0')}{' '}
            <i>/ {lessons.length}</i>
          </span>
          <span className={`difficulty ${lesson.difficulty}`}>
            {difficultyLabel[lesson.difficulty]}
          </span>
          <span className="meta-time">
            <Clock3 size={13} />
            {lesson.estimatedMinutes} 分钟
          </span>
        </div>
        <h1>{lesson.order === 1 ? '谁负责这个值？' : lesson.title}</h1>
        <p className="lesson-objective">{lesson.objective}</p>
      </div>
      {lesson.order === 1 && (
        <div className="first-screen-model">
          <div>
            <small>JAVA / GO</small>
            <p>
              内存生命周期 <span>→</span> <b>GC</b>
            </p>
          </div>
          <div className="model-separator">对比</div>
          <div>
            <small>RUST</small>
            <p>
              value <span>→</span> owner <span>→</span> scope ends{' '}
              <span>→</span> <b className="rust-orange">Drop</b>
            </p>
          </div>
        </div>
      )}
      {lesson.order !== 1 && (
        <>
          <section className="section-block">
            <div className="section-heading">
              <span className="section-icon">
                <BookOpen size={15} />
              </span>
              <div>
                <h2>核心概念</h2>
                <small>先从 Rust 自身语义出发</small>
              </div>
            </div>
            <p className="explanation">{lesson.explanation}</p>
          </section>
          {lesson.mentalModel && (
            <section className="mental-card">
              <div className="mental-title">
                <span>心智模型</span>
                <small>{lesson.mentalModel.description}</small>
              </div>
              <div className="mental-diagrams">
                {lesson.mentalModel.before && (
                  <pre>{lesson.mentalModel.before}</pre>
                )}
                {lesson.mentalModel.after && (
                  <>
                    <span className="diagram-arrow">
                      {lesson.mentalModel.before ? '→' : ''}
                    </span>
                    <pre>{lesson.mentalModel.after}</pre>
                  </>
                )}
              </div>
            </section>
          )}
        </>
      )}
      {lesson.examples.length > 0 && (
        <CodeExamples examples={lesson.examples} />
      )}
      {exercises.length > 0 && (
        <section className="exercise-card" id="exercise">
          <div className="exercise-topline">
            <div>
              <span className="exercise-eyebrow">
                <span className="exercise-dot" />
                互动练习
              </span>
              <h2>
                {activeExercise === 0 && lesson.order === 1
                  ? '这段代码会发生什么？'
                  : exercise.prompt}
              </h2>
            </div>
            <span className="exercise-counter">
              {String(activeExercise + 1).padStart(2, '0')}{' '}
              <i>/ {String(exercises.length).padStart(2, '0')}</i>
            </span>
          </div>
          {exercise.code && <CodeBlock code={exercise.code} compact />}
          {exercise.code && (
            <p className="exercise-prompt">
              复制上方代码到本地 Rust 项目，在自己的电脑上修改并运行。
            </p>
          )}
          {exercise.prompt !== '提交后预测：程序会怎样？' &&
            lesson.order === 1 &&
            activeExercise === 0 && (
              <p className="exercise-prompt">预测下面这段代码的结果。</p>
            )}
          {exercise.type === 'concept_question' ||
          exercise.type === 'architecture_question' ||
          exercise.type === 'code_completion' ||
          exercise.type === 'code_fix' ? (
            <OpenExercise
              key={exercise.id}
              exercise={exercise}
              existing={existing}
              onSubmit={onAttempt}
            />
          ) : (
            <ChoiceExercise
              key={exercise.id}
              exercise={exercise}
              existing={existing}
              onSubmit={onAttempt}
            />
          )}
          {exercise.tags.length > 0 && (
            <div className="tags-row">
              {exercise.tags.map((tag) => {
                // 展示练习关联的知识点标签。
                return (
                  <span key={tag} className="tag-pill">
                    {tagLabel(tag)}
                  </span>
                )
              })}
            </div>
          )}
          <div className="exercise-footer">
            <button
              className="secondary-button"
              disabled={activeExercise === 0}
              onClick={() => {
                // 切换到上一道练习。
                return setActiveExercise((n) => {
                  // 将上一题索引限制在题库起点。
                  return Math.max(0, n - 1)
                })
              }}
            >
              <ArrowLeft size={14} />
              上一题
            </button>
            <span>
              {activeExercise + 1} / {exercises.length}
            </span>
            {activeExercise < exercises.length - 1 ? (
              <button
                className="secondary-button"
                onClick={() => {
                  // 切换到下一道练习。
                  return setActiveExercise((n) => {
                    // 将下一题索引限制在题库终点。
                    return Math.min(exercises.length - 1, n + 1)
                  })
                }}
              >
                下一题 <ArrowRight size={14} />
              </button>
            ) : (
              <button
                className="primary-button compact-button"
                disabled={!allAnswered || done}
                onClick={onComplete}
              >
                {done ? '本课已完成' : '标记本课完成'} <Check size={14} />
              </button>
            )}
          </div>
        </section>
      )}
      {!exercises.length && (
        <section className="locked-lesson">
          <span className="locked-icon">
            <BookOpen size={17} />
          </span>
          <div>
            <b>路线节点预告 · {lesson.title}</b>
            <p>
              {lesson.objective} 前 8
              节提供完整课程与互动练习；后续节点先展示学习方向。
            </p>
          </div>
        </section>
      )}
      {exercises.length > 0 && (
        <div className="lesson-complete-row">
          {done ? (
            <>
              <CheckCircle2 size={15} />
              已完成本课{' '}
              <button className="text-link" onClick={onReview}>
                复习错题 <ArrowRight size={12} />
              </button>
            </>
          ) : (
            <>
              <span className="completion-ring" />
              完成练习后可标记本课完成
            </>
          )}
        </div>
      )}
      {lesson.order === 1 && (
        <>
          <section className="section-block">
            <div className="section-heading">
              <span className="section-icon">
                <BookOpen size={15} />
              </span>
              <div>
                <h2>核心概念</h2>
                <small>先从 Rust 自身语义出发</small>
              </div>
            </div>
            <p className="explanation">{lesson.explanation}</p>
          </section>
          {lesson.mentalModel && (
            <section className="mental-card">
              <div className="mental-title">
                <span>心智模型</span>
                <small>{lesson.mentalModel.description}</small>
              </div>
              <div className="mental-diagrams">
                {lesson.mentalModel.before && (
                  <pre>{lesson.mentalModel.before}</pre>
                )}
                {lesson.mentalModel.after && (
                  <>
                    <span className="diagram-arrow">→</span>
                    <pre>{lesson.mentalModel.after}</pre>
                  </>
                )}
              </div>
            </section>
          )}
        </>
      )}
      <section className="comparison-block">
        <div className="comparison-heading">
          <span className="comparison-symbol">⇄</span>
          <div>
            <h3>Rust vs Java vs Go</h3>
            <p>相似的代码，不同的内存模型</p>
          </div>
        </div>
        <div className="comparison-grid">
          {lesson.order === 1 ? (
            <>
              <CompareCode
                language="RUST"
                code={'let b = a;'}
                detail="String 所有权 move"
                color="orange"
              />
              <CompareCode
                language="JAVA"
                code={'String b = a;'}
                detail="复制引用，GC 管理对象"
                color="blue"
              />
              <CompareCode
                language="GO"
                code={'b := a'}
                detail="复制 string 值，GC 管理内存"
                color="cyan"
              />
            </>
          ) : (
            <div className="comparison-question">
              <span>试着回答</span>
              <b>
                {lesson.comparisonQuestion?.prompt ??
                  '完成本节后，想一想 Rust 的规则和你熟悉的语言有何差异。'}
              </b>
              <p>答题后会显示对照解析，帮助建立准确的语言模型。</p>
            </div>
          )}
        </div>
      </section>
      <section className="summary-block">
        <div className="summary-title">
          <span>✓</span>
          <h3>本课小结</h3>
        </div>
        <ul>
          {lesson.summary.map((item) => {
            // 按课程内容渲染本课小结。
            return <li key={item}>{item}</li>
          })}
        </ul>
      </section>
      <div className="bottom-navigation">
        <button
          className="text-link"
          onClick={() => {
            // 返回上一节原型课程。
            return onNavigate(lessons[Math.max(0, lesson.order - 2)])
          }}
          disabled={lesson.order === 1}
        >
          <ArrowLeft size={14} />
          上一课
        </button>
        <span>{done ? '本课已标记完成' : '完成练习后标记本课'}</span>
        <button
          className="primary-button"
          disabled={!allAnswered || done}
          onClick={onComplete}
        >
          {done ? '本课已完成' : '标记本课完成'}
          <Check size={15} />
        </button>
      </div>
    </>
  )
}
/** 展示跨语言对照片段及其语义说明。 */
export function CompareCode({
  language,
  code,
  detail,
  color,
}: {
  language: string
  code: string
  detail: string
  color: string
}): JSX.Element {
  return (
    <div className="compare-cell">
      <span className={`compare-lang ${color}`}>{language}</span>
      <code>{code}</code>
      <small>{detail}</small>
    </div>
  )
}
