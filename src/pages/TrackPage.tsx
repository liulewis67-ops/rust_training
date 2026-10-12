import type { JSX } from 'react'
import { ArrowLeft, ArrowRight, Clock3 } from 'lucide-react'
import { learningTrack } from '../data/learningTrack'
import type { Route } from '../app/router'

/** 展示主线阶段、时间和预期项目，并明确内容尚未开放。 */
export function TrackPage({
  onNavigate,
}: {
  onNavigate: (route: Route) => void
}): JSX.Element {
  /** 返回路线首页。 */
  function goHome(): void {
    onNavigate({ page: 'home' })
  }

  return (
    <article className="track-page">
      <button className="text-button track-back" onClick={goHome}>
        <ArrowLeft size={13} /> 首页
      </button>
      <header className="track-heading">
        <p className="home-eyebrow">LEARNING PATH · PLANNED</p>
        <h1>{learningTrack.title}</h1>
        <p>
          从语言基础推进到服务交付。阶段目标和项目来自课程方案；课程课件仍在规划，当前没有可完成的阶段。
        </p>
        <div className="track-meta">
          <span>
            <Clock3 size={14} /> {learningTrack.duration}
          </span>
          <span>{learningTrack.modules}</span>
          <span className="planned-badge">路线规划中</span>
        </div>
      </header>

      <ol className="track-phase-list">
        {learningTrack.phases.map((phase, index) => {
          // 阶段只呈现方案目标，不生成可点击或可完成的课程入口。
          return (
            <li className="track-phase" key={phase.id}>
              <div className="phase-marker" aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </div>
              <div className="phase-content">
                <div className="phase-title-row">
                  <div>
                    <span className="phase-code">
                      {phase.id} · {phase.moduleRange}
                    </span>
                    <h2>{phase.title}</h2>
                  </div>
                  <span className="planned-badge">规划中</span>
                </div>
                <p>{phase.outcome}</p>
                <span className="phase-duration">
                  约 {phase.hours} 小时 · 规划值
                </span>
              </div>
            </li>
          )
        })}
      </ol>

      <button className="secondary-button track-home-cta" onClick={goHome}>
        返回首页 <ArrowRight size={14} />
      </button>
    </article>
  )
}
