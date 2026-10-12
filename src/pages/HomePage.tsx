import type { JSX } from 'react'
import { ArrowRight, Boxes, BookOpen, Layers3, ShieldCheck } from 'lucide-react'
import { learningTrack } from '../data/learningTrack'
import type { Route } from '../app/router'
import {
  buildLearningRecommendations,
  type Progress,
} from '../features/learning'
import { lessons } from '../features/catalog'
import './learningRecommendations.css'

/** 展示平台方向和规划中的主线，并将用户带到路线详情。 */
export function HomePage({
  onNavigate,
  progress,
}: {
  onNavigate: (route: Route) => void
  progress: Progress
}): JSX.Element {
  const recommendations = buildLearningRecommendations(lessons, progress)
  /** 打开唯一已发布的路线方案页。 */
  function openTrack(): void {
    onNavigate({ page: 'track', trackSlug: learningTrack.slug })
  }

  /** Open the entry selected by the recommendation rule or the route plan. */
  function openRecommendation(index: number): void {
    const recommendation = recommendations[index]
    if (recommendation.destination === 'track') {
      openTrack()
      return
    }
    if (
      recommendation.destination !== 'lesson' ||
      !recommendation.destinationLessonId
    )
      return
    const lesson = lessons.find((item) => {
      // Resolve the recommendation ID against the trusted local lesson catalog.
      return item.id === recommendation.destinationLessonId
    })
    if (lesson) onNavigate({ page: 'lesson', lessonId: lesson.id })
  }

  return (
    <article className="home-page">
      <p className="home-eyebrow">RUST BACKEND ENGINEER TRACK</p>
      <section className="home-hero">
        <div className="home-hero-copy">
          <p className="home-kicker">面向有编程经验的开发者</p>
          <h1>从 Rust 基础，走到可交付的后端服务。</h1>
          <p className="home-description">
            沿着类型、异步、Axum
            与数据工程逐步深入，用真实项目练习完整开发循环。
          </p>
          <button className="primary-button home-cta" onClick={openTrack}>
            查看学习路线 <ArrowRight size={15} />
          </button>
        </div>
        <div className="home-route-card">
          <span className="home-card-icon">
            <BookOpen size={17} />
          </span>
          <p>主线规划</p>
          <h2>{learningTrack.title}</h2>
          <span>
            {learningTrack.duration} · {learningTrack.modules}
          </span>
          <span className="planned-badge">内容规划中</span>
        </div>
      </section>

      <section
        className="home-next-steps"
        aria-labelledby="home-next-steps-title"
      >
        <div className="home-section-heading">
          <div>
            <p className="home-kicker">YOUR NEXT STEP</p>
            <h2 id="home-next-steps-title">从一条清晰的下一步开始</h2>
          </div>
          <small>
            自报阅读 {countAvailableCompletions(progress)}/8 · 本地答题{' '}
            {progress.attempts.length}
          </small>
        </div>
        <p className="home-next-steps-note">
          建议只整理阅读和练习记录，不代表平台认证的能力等级。
        </p>
        <div className="home-next-step-grid">
          {recommendations.map((recommendation, index) => {
            // Present the rule result and its matching action without inferring a skill level.
            const statusLabel = {
              in_progress: '继续学习',
              not_started: '尚未开始',
              no_content: '暂无课件',
            }[recommendation.status]
            const actionLabel =
              recommendation.status === 'in_progress'
                ? recommendation.destination === 'track'
                  ? '查看路线规划'
                  : recommendation.reason.startsWith('还没有')
                    ? '开始第一节'
                    : '继续阅读'
                : recommendation.status === 'not_started'
                  ? recommendation.reason.startsWith('先修缺口')
                    ? '先看先修课程'
                    : '开始课程'
                  : '查看路线规划'
            return (
              <article
                className={`home-next-step home-next-step-${recommendation.status}`}
                key={recommendation.status}
              >
                <span className="home-next-step-status">{statusLabel}</span>
                <h3>{recommendation.title}</h3>
                <p>{recommendation.reason}</p>
                {recommendation.destination === 'none' ? (
                  <span className="home-next-step-disabled">
                    暂无可打开的未完成课程
                  </span>
                ) : (
                  // Keep the action directly connected to the rule's selected destination.
                  <button
                    className="secondary-button"
                    onClick={() => openRecommendation(index)}
                  >
                    {actionLabel} <ArrowRight size={13} />
                  </button>
                )}
              </article>
            )
          })}
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
        当前页面展示的是课程规划。主线课程尚未开放，规划阶段不会计作已完成学习。
      </p>
    </article>
  )
}

/** Count only self-reported completion entries among the eight currently opened lessons. */
function countAvailableCompletions(progress: Progress): number {
  let count = 0
  for (const completedId of progress.completed) {
    for (const lesson of lessons) {
      if (lesson.order <= 8 && lesson.id === completedId) {
        count += 1
        break
      }
    }
  }
  return count
}
