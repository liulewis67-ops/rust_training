import type { JSX } from 'react'
import { ArrowRight, Boxes, BookOpen, Layers3, ShieldCheck } from 'lucide-react'
import { learningTrack } from '../data/learningTrack'
import { courseModules } from '../data/courseCatalog'
import { listPublicCourseLessons } from '../data/publicCourse'
import type { Route } from '../app/router'
import type { Progress } from '../features/learning'
import './learningRecommendations.css'

/** Introduce the learning path and provide a direct route into its course catalog. */
export function HomePage({
  onNavigate,
  progress,
}: {
  onNavigate: (route: Route) => void
  progress: Progress
}): JSX.Element {
  const publishedLessons = courseModules.flatMap((module) =>
    module.lessons
      .filter((lesson) => lesson.content.trim())
      .map((lesson) => ({ moduleId: module.id, ...lesson })),
  )
  const completedPublished = publishedLessons.filter((lesson) =>
    progress.completed.includes(`${lesson.moduleId}-${lesson.id}`),
  ).length
  const nextLesson =
    publishedLessons.find(
      (lesson) =>
        !progress.completed.includes(`${lesson.moduleId}-${lesson.id}`),
    ) ?? publishedLessons[0]
  const publicLesson = listPublicCourseLessons()[0]
  /** 打开唯一已发布的路线方案页。 */
  function openTrack(): void {
    onNavigate({ page: 'track', trackSlug: learningTrack.slug })
  }

  /** Open the next published lesson in the main track. */
  function openNextLesson(): void {
    if (!nextLesson) return openTrack()
    onNavigate({
      page: 'course-lesson',
      moduleId: nextLesson.moduleId,
      lessonId: nextLesson.id,
    })
  }

  return (
    <article className="home-page">
      <p className="home-eyebrow">RUST BACKEND ENGINEER TRACK</p>
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="home-kicker">面向有编程经验的开发者</p>
          <h1>从 Rust 基础，走到可交付的后端服务。</h1>
          <p className="home-description">
            按 8 个阶段、24 个模块系统学习 Rust
            工程。在线阅读课程，在本地完成练习与项目。
          </p>
          <button className="primary-button home-cta" onClick={openTrack}>
            浏览课程目录 <ArrowRight size={15} />
          </button>
        </div>
        <div className="home-route-card">
          <span className="home-card-icon">
            <BookOpen size={17} />
          </span>
          <p>课程主线</p>
          <h2>{learningTrack.title}</h2>
          <span>8 个学习阶段 · 24 个模块 · 144 节课程</span>
          <span className="planned-badge">课程可浏览</span>
        </div>
      </section>

      <section
        className="home-next-steps"
        aria-labelledby="home-next-steps-title"
      >
        <div className="home-section-heading">
          <div>
            <p className="home-kicker">LOCAL STUDY</p>
            <h2 id="home-next-steps-title">从一条清晰的下一步开始</h2>
          </div>
          <small>
            主线已自报完成 {completedPublished} / {publishedLessons.length} 节
          </small>
        </div>
        <p className="home-next-steps-note">
          规划阶段不会计作已完成学习；已发布课程可直接阅读，本地记录也不代表平台认证的能力等级。
        </p>
        <div className="home-next-step-grid">
          <article className="home-next-step home-next-step-in_progress">
            <span className="home-next-step-status">主线下一课</span>
            <h3>
              {nextLesson
                ? `${nextLesson.moduleId}-${nextLesson.id} · ${nextLesson.title}`
                : '已发布课程准备中'}
            </h3>
            <p>按已发布课程的顺序阅读，在自己的电脑上完成练习。</p>
            <button className="secondary-button" onClick={openNextLesson}>
              {nextLesson ? '打开课节' : '查看课程目录'}{' '}
              <ArrowRight size={13} />
            </button>
          </article>
          {publicLesson && (
            <article className="home-next-step home-next-step-not_started">
              <span className="home-next-step-status">专题练习</span>
              <h3>{publicLesson.title}</h3>
              <p>阅读借用切片示例，并在本地 Cargo 项目中编写测试。</p>
              <button
                className="secondary-button"
                onClick={() =>
                  onNavigate({
                    page: 'public-course-lesson',
                    lessonId: publicLesson.id,
                  })
                }
              >
                打开课节 <ArrowRight size={13} />
              </button>
            </article>
          )}
          <article className="home-next-step home-next-step-no_content">
            <span className="home-next-step-status">路线规划</span>
            <h3>从 Rust 基础到工程交付</h3>
            <p>查看 24 个模块的学习目标，以及尚在准备的课节。</p>
            <button className="secondary-button" onClick={openTrack}>
              查看路线 <ArrowRight size={13} />
            </button>
          </article>
        </div>
      </section>

      <section className="home-section" aria-labelledby="home-projects-title">
        <div className="home-section-heading">
          <div>
            <p className="home-kicker">LEARN BY BUILDING</p>
            <h2 id="home-projects-title">沿途交付真实工程成果</h2>
          </div>
          <button className="text-button" onClick={openTrack}>
            查看阶段 <ArrowRight size={13} />
          </button>
        </div>
        <div className="home-pillars">
          <article className="home-pillar">
            <span>
              <Layers3 size={16} />
            </span>
            <small>P1 · 工程化</small>
            <h3>日志分析 CLI</h3>
            <p>把类型建模、错误处理与测试组合成可交付工具。</p>
            <span className="planned-label">规划中</span>
          </article>
          <article className="home-pillar">
            <span>
              <ArrowRight size={16} />
            </span>
            <small>P2 · 异步</small>
            <h3>受限并发执行器</h3>
            <p>练习任务调度、取消、背压与资源边界。</p>
            <span className="planned-label">规划中</span>
          </article>
          <article className="home-pillar">
            <span>
              <ShieldCheck size={16} />
            </span>
            <small>P3 · 服务端</small>
            <h3>持久化后端服务</h3>
            <p>从 API 契约继续走向权限、可靠性和数据安全。</p>
            <span className="planned-label">规划中</span>
          </article>
          <article className="home-pillar">
            <span>
              <Boxes size={16} />
            </span>
            <small>P4 · 生产交付</small>
            <h3>可部署服务与答辩</h3>
            <p>综合构建、发布、恢复、性能证据和维护实践。</p>
            <span className="planned-label">规划中</span>
          </article>
        </div>
      </section>

      <p className="home-disclosure" role="status">
        代码练习在本地电脑完成；本站不提供在线运行或平台评测。
      </p>
    </article>
  )
}
