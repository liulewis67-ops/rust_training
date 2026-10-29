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
import { organizeLessonMarkdown } from '../features/reading/lessonStructure'
import { lessonTitle, moduleText } from '../data/courseText'
import { locateContinuity, continuityLabel } from '../data/learningContinuity'
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

  const progress = locateContinuity(moduleId, lessonId)
  const body = lesson.content.replace(/^#\s+[^\r\n]*(?:\r?\n|$)\s*/, '')
  const sourceHeading = /^#\s+([^\r\n]+)/.exec(lesson.content)?.[1]
  const sections = organizeLessonMarkdown(body)
  const navigationSections = sections.filter(
    (section) => section.title && section.id && section.kind !== 'reference',
  )
  const readingPhases = [
    {
      kind: 'prepare',
      title: t('01 · 建立上下文', '01 · Establish the context'),
    },
    { kind: 'concept', title: t('02 · 推导与决策', '02 · Reason and decide') },
    { kind: 'apply', title: t('03 · 实践与验收', '03 · Practice and verify') },
  ]

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
        <div className="course-reader-heading-meta">
          <span className="course-reader-reading-status">
            <BookOpen size={14} aria-hidden="true" />{' '}
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
            <Check size={14} aria-hidden="true" />
          </button>
        </div>
      </header>

      {language === 'en' && !lesson.translationComplete && (
        <p className="translation-note">
          Some lesson text and exercises are still available only in Chinese.
        </p>
      )}
      {progress && (
        <section
          className="course-module-journey"
          aria-label={t('本模块工程推进路线', 'Module engineering progression')}
        >
          <div className="course-module-journey-header">
            <span className="course-module-journey-kicker">
              {t('连续工程任务', 'Connected engineering steps')}
            </span>
            <h2>{continuityLabel(progress.module.goal, language)}</h2>
            <p>
              {t(
                '每一步解决上一步留下的限制，并交付下一步需要的结果。',
                'Each step removes a prior limitation and produces evidence for the next.',
              )}
            </p>
          </div>
          <ol className="course-module-journey-steps">
            {progress.module.steps.map((step, index) => (
              <li key={step.id}>
                <button
                  type="button"
                  className={index === progress.index ? 'is-current' : ''}
                  aria-current={index === progress.index ? 'step' : undefined}
                  onClick={() =>
                    onNavigate({
                      page: 'course-lesson',
                      moduleId: progress.module.id,
                      lessonId: step.id.slice(-3),
                    })
                  }
                >
                  <span className="course-module-journey-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="course-module-journey-label">
                    {continuityLabel(step.label, language)}
                  </span>
                </button>
              </li>
            ))}
          </ol>
          <p className="course-module-journey-current">
            <strong>{t('当前要解决', 'Current problem')}</strong>
            {continuityLabel(progress.step.problem, language)}
          </p>
        </section>
      )}
      <div className="course-reading-guide">
        <div className="course-reading-guide-intro">
          <strong>{t('本节学习路线', 'Learning path')}</strong>
          <p>
            {t(
              '先确认目标与前置知识，再逐个理解核心概念，最后通过本地练习检验。',
              'Check the goals and prerequisites, explore each concept, then verify your understanding locally.',
            )}
          </p>
        </div>
        <nav
          aria-label={t('本节目录', 'On this page')}
          className="course-reading-toc course-reading-toc--grouped"
        >
          {readingPhases.map((phase) => {
            const items = navigationSections.filter(
              (section) => section.kind === phase.kind,
            )
            if (!items.length && phase.kind !== 'apply') return null
            return (
              <div className="course-reading-toc-group" key={phase.kind}>
                <h3>{phase.title}</h3>
                <div className="course-reading-toc-links">
                  {items.map((section) => (
                    <a
                      key={section.id}
                      href={`#${section.id}`}
                      onClick={(event) => {
                        event.preventDefault()
                        document
                          .getElementById(section.id!)
                          ?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                      }}
                    >
                      {section.step !== null && (
                        <span aria-hidden="true">
                          {String(section.step).padStart(2, '0')}
                        </span>
                      )}
                      {section.title}
                    </a>
                  ))}
                  {phase.kind === 'apply' && lesson.exercises.length > 0 && (
                    <a
                      href="#lesson-practice"
                      onClick={(event) => {
                        event.preventDefault()
                        document
                          .getElementById('lesson-practice')
                          ?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                      }}
                    >
                      {t('练习与实验', 'Exercises and labs')}
                    </a>
                  )}
                </div>
              </div>
            )
          })}
        </nav>
      </div>
      <div
        className="course-reading-sections"
        aria-label={t('课程正文', 'Lesson content')}
      >
        {sections.map((section, index) => (
          <section
            className={`course-reading-step course-reading-step--${section.kind}`}
            aria-label={section.title ?? t('导读', 'Introduction')}
            key={section.id ?? `intro-${index}`}
          >
            {section.step !== null && (
              <span className="course-reading-step-label">
                {t('知识点', 'Concept')} {String(section.step).padStart(2, '0')}
              </span>
            )}
            <SafeMarkdown
              content={section.markdown}
              language={language}
              initialHeadingOccurrences={section.headingOccurrences}
            />
          </section>
        ))}
      </div>
      <aside className="local-practice-note">
        {t(
          '代码练习在你的本地电脑上完成。复制示例或下载课件中的模板，再按题面给出的命令运行和检查结果。',
          'Complete coding exercises on your computer. Copy examples or download templates from the lesson, then run the commands shown in the exercise.',
        )}
      </aside>

      {lesson.exercises.length > 0 && (
        <section
          className="course-reader-exercises"
          id="lesson-practice"
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
