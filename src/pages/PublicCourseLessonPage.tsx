import type { JSX } from 'react'
import { ArrowLeft, Check } from 'lucide-react'
import { CodeBlock } from '../components/CodeBlock'
import {
  findPublicCourseLesson,
  getPublicCourse,
  getPublicExample,
  getPublicExercise,
  getPublicResource,
} from '../data/publicCourse'
import type { Route } from '../app/router'
import { SafeMarkdown } from '../features/content/SafeMarkdown'

/** Read a course pack that is explicitly listed as public in the repository manifest. */
export function PublicCourseLessonPage({
  lessonId,
  completed,
  onComplete,
  onNavigate,
}: {
  lessonId: string
  completed: boolean
  onComplete: () => void
  onNavigate: (route: Route) => void
}): JSX.Element {
  const course = getPublicCourse()
  const lesson = findPublicCourseLesson(lessonId)
  if (!lesson) {
    return (
      <article className="course-reader">
        <h1>课程暂不可用</h1>
        <button
          className="text-button"
          onClick={() => onNavigate({ page: 'search' })}
        >
          <ArrowLeft size={13} /> 返回搜索
        </button>
      </article>
    )
  }

  return (
    <article className="course-reader">
      <button
        className="text-button course-reader-back"
        onClick={() => onNavigate({ page: 'search' })}
      >
        <ArrowLeft size={13} /> 课程搜索
      </button>
      <header className="course-reader-heading">
        <p className="home-eyebrow">公开课包 · {course.course_id}</p>
        <h1>{lesson.title}</h1>
        <p>{lesson.objectives.join('；')}</p>
        <span>课程阅读 · 编程练习在本地电脑完成</span>
        <button
          type="button"
          className="secondary-button course-completion-button"
          onClick={onComplete}
        >
          {completed ? '已自报完成' : '标记本节已完成'} <Check size={14} />
        </button>
      </header>

      {lesson.terms.length > 0 && (
        <section className="course-reader-section" aria-label="关键术语">
          <h2>关键术语</h2>
          <dl>
            {lesson.terms.map((term) => (
              <div key={term.term}>
                <dt>{term.term}</dt>
                <dd>{term.definition}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {lesson.blocks.map((block, index) => (
        <section
          className="course-reader-section"
          aria-label={`课程正文 ${index + 1}`}
          key={index}
        >
          <SafeMarkdown content={block.text} />
        </section>
      ))}

      {lesson.example_ids.map((exampleId) => {
        const code = getPublicExample(exampleId)
        if (!code) return null
        return (
          <section className="course-reader-section" key={exampleId}>
            <h2>代码示例</h2>
            <CodeBlock code={code} />
          </section>
        )
      })}

      {lesson.exercise_ids.map((exerciseId) => {
        const exercise = getPublicExercise(exerciseId)
        if (!exercise) return null
        return (
          <section className="course-reader-exercises" key={exerciseId}>
            <h2>本地练习</h2>
            <p>{exercise.prompt}</p>
            {exercise.hints.length > 0 && (
              <details>
                <summary>查看提示</summary>
                <ul>
                  {exercise.hints.map((hint) => (
                    <li key={hint}>{hint}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
        )
      })}

      {lesson.resource_ids.map((resourceId) => {
        const resource = getPublicResource(resourceId)
        if (!resource) return null
        return (
          <section className="course-reader-section" key={resourceId}>
            <h2>练习材料</h2>
            <SafeMarkdown content={resource} />
          </section>
        )
      })}
    </article>
  )
}
