import { useEffect, useState, type JSX } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check } from 'lucide-react'
import {
  courseModules,
  findCourseLesson,
  findCourseModule,
  loadCourseLesson,
} from '../data/courseCatalog'
import type { Route } from '../app/router'
import { SafeMarkdown } from '../features/content/SafeMarkdown'
import { markdownHeadingSlug } from '../lib/markdownAnchor'
import { lessonTitle, moduleText } from '../data/courseText'
import { useLanguage } from '../features/preferences'

/** Read one complete authored lesson and move through the route in order. */
export function CourseLessonPage({
  moduleId,
  lessonId,
  sectionId,
  completed,
  onComplete,
  onNavigate,
}: {
  moduleId: string
  lessonId: string
  sectionId?: string
  completed: boolean
  onComplete: () => void
  onNavigate: (route: Route) => void
}): JSX.Element {
  const { language, t } = useLanguage()
  useEffect(() => {
    // Start each lesson at its heading after client-side navigation.
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [moduleId, lessonId])
  const module = findCourseModule(moduleId)
  const lessonMetadata = findCourseLesson(moduleId, lessonId)
  const [lesson, setLesson] = useState<typeof lessonMetadata>()
  useEffect(() => {
    let active = true
    setLesson(undefined)
    void loadCourseLesson(moduleId, lessonId, language).then((loaded) => {
      if (active) setLesson(loaded)
    })
    return () => {
      active = false
    }
  }, [moduleId, lessonId, language])
  useEffect(() => {
    if (!sectionId || !lesson) return
    const target = document.getElementById(sectionId)
    target?.scrollIntoView({ behavior: 'auto', block: 'start' })
  }, [lesson, sectionId])
  const orderedLessons = courseModules.flatMap((courseModule) =>
    courseModule.lessons
      .filter((courseLesson) => courseLesson.published)
      .map((courseLesson) => ({
        module: courseModule,
        lesson: courseLesson,
      })),
  )
  const currentIndex = orderedLessons.findIndex(
    (entry) =>
      entry.module.id === module?.id && entry.lesson.id === lessonMetadata?.id,
  )
  const previous =
    currentIndex > 0 ? orderedLessons[currentIndex - 1] : undefined
  const next = orderedLessons[currentIndex + 1]

  /** Navigate to a lesson while preserving the catalog's canonical IDs. */
  function openLesson(entry: (typeof orderedLessons)[number]): void {
    onNavigate({
      page: 'course-lesson',
      moduleId: entry.module.id,
      lessonId: entry.lesson.id,
    })
  }

  if (!module || !lessonMetadata?.published) {
    return (
      <article className="course-reader">
        <h1>{t('课程暂不可用', 'Lesson unavailable')}</h1>
        <button
          className="text-button"
          onClick={() =>
            onNavigate({ page: 'track', trackSlug: 'rust-backend' })
          }
        >
          <ArrowLeft size={13} /> {t('返回课程目录', 'Back to catalog')}
        </button>
      </article>
    )
  }

  if (!lesson) {
    return (
      <article className="course-reader">
        <p role="status">{t('正在加载课程…', 'Loading lesson…')}</p>
      </article>
    )
  }

  const body = lesson.content.replace(/^#\s+[^\r\n]*(?:\r?\n|$)\s*/, '')
  const sourceHeading = /^#\s+([^\r\n]+)/.exec(lesson.content)?.[1]

  return (
    <article className="course-reader">
      <button
        className="text-button course-reader-back"
        onClick={() => onNavigate({ page: 'track', trackSlug: 'rust-backend' })}
      >
        <ArrowLeft size={13} /> {module.id} ·{' '}
        {moduleText(module.id, language, 'title', module.title)}
      </button>
      <header className="course-reader-heading">
        <p className="home-eyebrow">
          {module.phaseId} · {module.id} · {lesson.id}
        </p>
        <h1 id={markdownHeadingSlug(sourceHeading ?? lesson.title)}>
          {lessonTitle(module.id, lesson.id, language, lesson.title)}
        </h1>
        <p>{moduleText(module.id, language, 'outcome', module.outcome)}</p>
        <span>
          <BookOpen size={14} />{' '}
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

      {language === 'en' && !lesson.translationComplete && (
        <p className="translation-note">
          Some lesson text and exercises are still available only in Chinese.
        </p>
      )}
      <section
        className="course-reader-section"
        aria-label={t('课程正文', 'Lesson content')}
      >
        <SafeMarkdown content={body} language={language} />
      </section>
      <aside className="local-practice-note">
        {t(
          '代码练习在你的本地电脑上完成。复制示例或下载课件中的模板，再按题面给出的命令运行和检查结果。',
          'Complete coding exercises on your computer. Copy examples or download templates from the lesson, then run the commands shown in the exercise.',
        )}
      </aside>

      {lesson.exercises.length > 0 && (
        <section
          className="course-reader-exercises"
          aria-label={t('练习与实验题面', 'Exercises and labs')}
        >
          <h2>{t('练习与实验', 'Exercises and labs')}</h2>
          {lesson.exercises.map((content, index) => (
            <div
              className="course-reader-exercise"
              key={`${lesson.id}-${index}`}
            >
              <SafeMarkdown content={content} language={language} />
            </div>
          ))}
        </section>
      )}

      <nav
        className="course-reader-navigation"
        aria-label={t('课程前后导航', 'Previous and next lessons')}
      >
        {previous ? (
          <button type="button" onClick={() => openLesson(previous)}>
            <ArrowLeft size={14} />
            <span>
              <small>{t('上一节', 'Previous')}</small>
              <strong>
                {lessonTitle(
                  previous.module.id,
                  previous.lesson.id,
                  language,
                  previous.lesson.title,
                )}
              </strong>
            </span>
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button type="button" onClick={() => openLesson(next)}>
            <span>
              <small>{t('下一节', 'Next')}</small>
              <strong>
                {lessonTitle(
                  next.module.id,
                  next.lesson.id,
                  language,
                  next.lesson.title,
                )}
              </strong>
            </span>
            <ArrowRight size={14} />
          </button>
        ) : (
          <span />
        )}
      </nav>
    </article>
  )
}
