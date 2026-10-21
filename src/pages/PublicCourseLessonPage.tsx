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
import { useLanguage } from '../features/preferences'

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
  const { language, t } = useLanguage()
  const course = getPublicCourse(language)
  const lesson = findPublicCourseLesson(lessonId, language)
  if (!lesson) {
    return (
      <article className="course-reader">
        <h1>{t('课程暂不可用', 'Lesson unavailable')}</h1>
        <button
          className="text-button"
          onClick={() => onNavigate({ page: 'search' })}
        >
          <ArrowLeft size={13} /> {t('返回搜索', 'Back to search')}
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
        <ArrowLeft size={13} /> {t('课程搜索', 'Course search')}
      </button>
      <header className="course-reader-heading">
        <p className="home-eyebrow">
          {t('公开课包', 'Public course pack')} · {course.course_id}
        </p>
        <h1>{lesson.title}</h1>
        <p>{lesson.objectives.join(language === 'en' ? '; ' : '；')}</p>
        <span>
          {t(
            '课程阅读 · 编程练习在本地电脑完成',
            'Read the lesson · Complete coding exercises locally',
          )}
        </span>
        <button
          type="button"
          className="secondary-button course-completion-button"
          onClick={onComplete}
        >
          {completed
            ? t('已自报完成', 'Marked complete')
            : t('标记本节已完成', 'Mark lesson complete')}{' '}
          <Check size={14} />
        </button>
      </header>

      {lesson.terms.length > 0 && (
        <section
          className="course-reader-section"
          aria-label={t('关键术语', 'Key terms')}
        >
          <h2>{t('关键术语', 'Key terms')}</h2>
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
          aria-label={t(`课程正文 ${index + 1}`, `Lesson content ${index + 1}`)}
          key={index}
        >
          <SafeMarkdown content={block.text} language={language} />
        </section>
      ))}

      {lesson.example_ids.map((exampleId) => {
        const code = getPublicExample(exampleId)
        if (!code) return null
        return (
          <section className="course-reader-section" key={exampleId}>
            <h2>{t('代码示例', 'Code example')}</h2>
            <CodeBlock code={code} />
          </section>
        )
      })}

      {lesson.exercise_ids.map((exerciseId) => {
        const exercise = getPublicExercise(exerciseId, language)
        if (!exercise) return null
        return (
          <section className="course-reader-exercises" key={exerciseId}>
            <h2>{t('本地练习', 'Local exercise')}</h2>
            <p>{exercise.prompt}</p>
            {exercise.hints.length > 0 && (
              <details>
                <summary>{t('查看提示', 'Show hints')}</summary>
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
        const resource = getPublicResource(resourceId, language)
        if (!resource) return null
        return (
          <section className="course-reader-section" key={resourceId}>
            <h2>{t('练习材料', 'Exercise material')}</h2>
            <SafeMarkdown content={resource} language={language} />
          </section>
        )
      })}
    </article>
  )
}
