import type { JSX } from 'react'
import { Check, ChevronRight, Flame, X } from 'lucide-react'
import { lessons, categories } from '../features/catalog'
import type { Progress } from '../features/learning'

/** 按设备时区显示原型答题日期。 */
function dateText(date: string): string {
  return new Date(date).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  })
}

/** 显示本地阅读统计与练习记录；自评不作为平台成绩。 */
export function ProgressPage({
  progress,
  accuracy,
}: {
  progress: Progress
  accuracy: number | null
}): JSX.Element {
  const categoryStats = categories.map((category) => {
    // 按完整课程分类计算阅读完成数。

    const lessonsOfCategory = lessons.filter((item) => {
      // 筛选属于当前分类的课程。
      return item.category === category
    })
    const complete = lessonsOfCategory.filter((item) => {
      // 统计该分类已标记完成的课程。
      return progress.completed.includes(item.id)
    }).length
    return { category, complete, total: lessonsOfCategory.length }
  })
  const recent = [...progress.attempts].reverse().slice(0, 8)
  return (
    <div className="utility-page">
      <div className="breadcrumb">
        <span>学习工具</span>
        <ChevronRight size={13} />
        <span>学习统计</span>
      </div>
      <div className="utility-title-row">
        <div>
          <span className="utility-eyebrow">YOUR PROGRESS</span>
          <h1>学习统计</h1>
          <p>把注意力放在能带走的技能上。</p>
        </div>
        <div className="review-count">
          <Flame size={17} />
          <b>{progress.streak}</b>
          <small>天 streak</small>
        </div>
      </div>
      <div className="progress-summary">
        <div>
          <small>完成课程</small>
          <strong>
            {progress.completed.length}
            <em> / {lessons.length}</em>
          </strong>
        </div>
        <div>
          <small>答题数量</small>
          <strong>{progress.attempts.length}</strong>
        </div>
        <div>
          <small>客观题正确率</small>
          <strong>{accuracy !== null ? `${accuracy}%` : '—'}</strong>
        </div>
      </div>
      <section className="mastery-section">
        <h2>分类阅读进度</h2>
        <p>按路线统计已完成课程</p>
        {categoryStats.map((item) => {
          // 显示分类阅读进度条与数量。
          return (
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
          )
        })}
      </section>
      <section className="mastery-section recent-section">
        <h2>最近答题</h2>
        {recent.length ? (
          recent.map((attempt, index) => {
            // 显示最近的本地答题记录与来源。

            const lesson = lessons.find((item) => {
              // 用历史课程 ID 查找当前可用标题。
              return item.id === attempt.lessonId
            })
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
                  <small>
                    {attempt.exerciseId} ·{' '}
                    {attempt.selfScore === undefined
                      ? '本地客观练习'
                      : `自评 ${attempt.selfScore}/5`}
                  </small>
                </div>
                <time>{dateText(attempt.at)}</time>
              </div>
            )
          })
        ) : (
          <div className="no-attempts">
            完成第一题后，这里会显示你的答题记录。
          </div>
        )}
      </section>
    </div>
  )
}
