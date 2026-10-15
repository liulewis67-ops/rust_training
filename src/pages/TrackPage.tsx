import type { JSX } from 'react'
import { ArrowLeft, ArrowRight, BookOpen } from 'lucide-react'
import { courseModules, coursePhases } from '../data/courseCatalog'
import { learningTrack } from '../data/learningTrack'
import type { Route } from '../app/router'

/** Browse every phase, module, and lesson in the authored Rust learning track. */
export function TrackPage({
  onNavigate,
}: {
  onNavigate: (route: Route) => void
}): JSX.Element {
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
          按阶段浏览 24 个模块与 144
          节课程。每节包括教学正文；适用时附有练习、实验或独立检查题面。
        </p>
        <div className="track-meta">
          <span>
            <BookOpen size={14} /> 8 个学习阶段
          </span>
          <span>24 个模块</span>
          <span>144 节课程</span>
        </div>
      </header>

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
