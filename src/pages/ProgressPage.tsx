import type { JSX } from 'react'
import { Check, ChevronRight, Flame, Trash2, X } from 'lucide-react'
import { lessons, categories } from '../features/catalog'
import { summarizeProgress } from '../features/learning'
import type { Progress } from '../features/learning'

/** Show learner-reported browser progress without presenting it as certification. */
export function ProgressPage({
  progress,
  accuracy,
  onClear,
}: {
  progress: Progress
  accuracy: number | null
  onClear: () => void
}): JSX.Element {
  const categoryStats = categories.map((category) => {
    const categoryLessons = lessons.filter(
      (lesson) => lesson.category === category,
    )
    const complete = categoryLessons.filter((lesson) =>
      progress.completed.includes(lesson.id),
    ).length
    return { category, complete, total: categoryLessons.length }
  })
  const recent = [...progress.attempts].reverse().slice(0, 8)
  const summary = summarizeProgress(progress)

  /** Ask before removing the progress stored for this project in this browser. */
  function clearAfterConfirmation(): void {
    if (window.confirm('清空本站保存在此浏览器中的学习记录？')) onClear()
  }

  return (
    <div className="utility-page">
      <div className="breadcrumb">
        <span>学习工具</span>
        <ChevronRight size={13} />
        <span>学习进度</span>
      </div>
      <div className="utility-title-row">
        <div>
          <span className="utility-eyebrow">LOCAL PROGRESS</span>
          <h1>学习进度</h1>
          <p>这些记录由你自行标记，只保存在当前浏览器。</p>
        </div>
        <div className="review-count">
          <Flame size={17} />
          <b>{progress.streak}</b>
          <small>天有学习记录</small>
        </div>
      </div>
      <div className="progress-summary">
        <div>
          <small>自报完成课程</small>
          <strong>
            {progress.completed.length}
            <em> / {lessons.length}</em>
          </strong>
        </div>
        <div>
          <small>已答题目</small>
          <strong>{summary.answered}</strong>
        </div>
        <div>
          <small>客观题练习正确率</small>
          <strong>{accuracy !== null ? `${accuracy}%` : '—'}</strong>
        </div>
      </div>
      <section className="mastery-section">
        <h2>分类进度</h2>
        <p>完成状态来自你的本地记录，不代表能力认证。</p>
        {categoryStats.map((item) => (
          <div className="mastery-row" key={item.category}>
            <span>{item.category}</span>
            <div className="progress-track">
              <span
                style={{
                  width: `${item.total ? (item.complete / item.total) * 100 : 0}%`,
                }}
              />
            </div>
            <small>
              {item.complete}/{item.total}
            </small>
          </div>
        ))}
      </section>
      <section className="mastery-section recent-section">
        <h2>最近练习</h2>
        {recent.length ? (
          recent.map((attempt, index) => {
            const lesson = lessons.find((item) => item.id === attempt.lessonId)
            return (
              <div
                className="recent-row"
                key={`${attempt.exerciseId}-${index}`}
              >
                <span
                  className={`recent-status ${attempt.correct ? 'pass' : 'fail'}`}
                >
                  {attempt.correct ? <Check size={13} /> : <X size={13} />}
                </span>
                <div>
                  <b>{lesson?.title ?? attempt.lessonId}</b>
                  <small>{attempt.exerciseId} · 本地练习记录</small>
                </div>
                <time>
                  {new Date(attempt.at).toLocaleDateString('zh-CN', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </time>
              </div>
            )
          })
        ) : (
          <div className="no-attempts">
            完成一道题后，最近练习会显示在这里。
          </div>
        )}
      </section>
      <section className="mastery-section local-record-actions">
        <h2>本地记录</h2>
        <p>
          记录可能因清理浏览器数据、更换设备或浏览器限制而丢失。课程无需记录即可使用。
        </p>
        <button
          type="button"
          className="secondary-button"
          onClick={clearAfterConfirmation}
        >
          <Trash2 size={14} /> 清空本站学习记录
        </button>
      </section>
    </div>
  )
}
