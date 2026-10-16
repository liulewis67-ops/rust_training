import type { JSX } from 'react'
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react'
import { courseModules, coursePhases } from '../data/courseCatalog'
import { learningTrack } from '../data/learningTrack'
import { getPublicCourse, listPublicCourseLessons } from '../data/publicCourse'
import type { Route } from '../app/router'

/** Browse every phase, module, and lesson in the authored Rust learning track. */
export function TrackPage({
  onNavigate,
}: {
  onNavigate: (route: Route) => void
}): JSX.Element {
  const publishedCourse = getPublicCourse()
  const publishedLessons = listPublicCourseLessons()

  /** Return to the platform home page. */
  function goHome(): void {
    onNavigate({ page: 'home' })
  }

  return (
    <article className="track-page course-catalog-page">
      <button className="text-button track-back" onClick={goHome}>
        <ArrowLeft size={13} /> 首页
      </button>
      <header className="track-heading">
        <p className="home-eyebrow">COURSE CATALOG · RUST BACKEND</p>
        <h1>{learningTrack.title}</h1>
        <p>
          按阶段浏览 24 个模块和规划中的 144
          节课程。已经准备好的课件可以直接阅读；其余课程会标明准备状态。
        </p>
        <div className="track-meta">
          <span>
            <BookOpen size={14} /> 8 个学习阶段
          </span>
          <span>24 个模块</span>
          <span>144 节课程</span>
        </div>
      </header>

      <section
        className="published-course-section"
        aria-labelledby="published-course-title"
      >
        <div>
          <p className="home-eyebrow">PUBLISHED COURSE</p>
          <h2 id="published-course-title">已发布课件</h2>
          <p>只有明确列入公开清单的课节会出现在这里。</p>
        </div>
        {publishedLessons.length > 0 ? (
          <ol>
            {publishedLessons.map((lesson) => (
              <li key={lesson.id}>
                <button
                  type="button"
                  onClick={() =>
                    onNavigate({
                      page: 'public-course-lesson',
                      lessonId: lesson.id,
                    })
                  }
                >
                  <span>{publishedCourse.title}</span>
                  <strong>{lesson.title}</strong>
                  <ArrowRight size={13} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p>首批 Markdown 课程仍在准备中。</p>
        )}
      </section>

      <ol className="track-phase-list course-phase-list">
        {coursePhases.map((phase, index) => {
          const modules = courseModules.filter(
            (module) => module.phaseId === phase.id,
          )
          return (
            <li className="track-phase course-phase" key={phase.id}>
              <div className="phase-marker" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </div>
              <section className="phase-content">
                <div className="phase-title-row">
                  <div>
                    <span className="phase-code">
                      {phase.id} · {phase.moduleRange}
                    </span>
                    <h2>{phase.title}</h2>
                  </div>
                  <span className="phase-duration">约 {phase.hours} 小时</span>
                </div>
                <p>{phase.outcome}</p>
                <div className="course-module-list">
                  {modules.map((module) => (
                    <details className="course-module" key={module.id}>
                      <summary>
                        <span className="course-module-id">{module.id}</span>
                        <span className="course-module-title">
                          <strong>{module.title}</strong>
                          <small>{module.outcome}</small>
                        </span>
                        <span className="course-module-count">6 节</span>
                      </summary>
                      <ol className="course-lesson-list">
                        {module.lessons.map((lesson) => (
                          <li key={lesson.id}>
                            {lesson.published ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onNavigate({
                                    page: 'course-lesson',
                                    moduleId: module.id,
                                    lessonId: lesson.id,
                                  })
                                }
                              >
                                <span>
                                  {module.id}-{lesson.id}
                                </span>
                                <strong>{lesson.title}</strong>
                                <ArrowRight size={13} aria-hidden="true" />
                              </button>
                            ) : (
                              <span className="course-lesson-unavailable">
                                <span>
                                  {module.id}-{lesson.id}
                                </span>
                                <strong>{lesson.title}</strong>
                                <small>课程准备中</small>
                              </span>
                            )}
                          </li>
                        ))}
                      </ol>
                    </details>
                  ))}
                </div>
              </section>
            </li>
          )
        })}
      </ol>
    </article>
  )
}
