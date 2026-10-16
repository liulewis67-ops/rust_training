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

/** Read one complete authored lesson and move through the route in order. */
export function CourseLessonPage({
  moduleId,
  lessonId,
  completed,
  onComplete,
  onNavigate,
}: {
  moduleId: string
  lessonId: string
  completed: boolean
  onComplete: () => void
  onNavigate: (route: Route) => void
}): JSX.Element {
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
    void loadCourseLesson(moduleId, lessonId).then((loaded) => {
      if (active) setLesson(loaded)
    })
    return () => {
      active = false
    }
  }, [moduleId, lessonId])
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
        <h1>课程暂不可用</h1>
        <button
          className="text-button"
          onClick={() =>
            onNavigate({ page: 'track', trackSlug: 'rust-backend' })
          }
        >
          <ArrowLeft size={13} /> 返回课程目录
        </button>
      </article>
    )
  }

  if (!lesson) {
    return (
      <article className="course-reader">
        <p role="status">正在加载课程…</p>
      </article>
    )
  }

  const body = lesson.content.replace(/^#\s+[^\r\n]*(?:\r?\n|$)\s*/, '')

  return (
    <article className="course-reader">
      <button
        className="text-button course-reader-back"
        onClick={() => onNavigate({ page: 'track', trackSlug: 'rust-backend' })}
      >
        <ArrowLeft size={13} /> {module.id} · {module.title}
      </button>
      <header className="course-reader-heading">
        <p className="home-eyebrow">
          {module.phaseId} · {module.id} · {lesson.id}
        </p>
        <h1>{lesson.title}</h1>
        <p>{module.outcome}</p>
        <span>
          <BookOpen size={14} /> 课程阅读 · 编程练习在本地电脑完成
        </span>
        <button
          type="button"
          className="secondary-button course-completion-button"
          onClick={onComplete}
        >
          {completed ? '已自报完成' : '标记本节已完成'} <Check size={14} />
        </button>
      </header>

      <section className="course-reader-section" aria-label="课程正文">
        <SafeMarkdown content={body} />
      </section>
      <aside className="local-practice-note">
        代码练习在你的本地电脑上完成。复制示例或下载课件中的模板，再按题面给出的命令运行和检查结果。
      </aside>

      {lesson.exercises.length > 0 && (
        <section
          className="course-reader-exercises"
          aria-label="练习与实验题面"
        >
          <h2>练习与实验</h2>
          {lesson.exercises.map((content, index) => (
            <div
              className="course-reader-exercise"
              key={`${lesson.id}-${index}`}
            >
              <SafeMarkdown content={content} />
            </div>
          ))}
        </section>
      )}

      <nav className="course-reader-navigation" aria-label="课程前后导航">
        {previous ? (
          <button type="button" onClick={() => openLesson(previous)}>
            <ArrowLeft size={14} />
            <span>
              <small>上一节</small>
              <strong>{previous.lesson.title}</strong>
            </span>
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button type="button" onClick={() => openLesson(next)}>
            <span>
              <small>下一节</small>
              <strong>{next.lesson.title}</strong>
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
