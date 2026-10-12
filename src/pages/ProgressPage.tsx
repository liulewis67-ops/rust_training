import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import { Check, ChevronRight, Flame, X } from 'lucide-react'
import { lessons, categories } from '../features/catalog'
import type { LegacyProgressPreview, Progress } from '../features/learning'

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
  onTimeZoneSave,
  canRetrySync,
  onRetrySync,
  legacyPreview,
  onLegacyImport,
}: {
  progress: Progress
  accuracy: number | null
  onTimeZoneSave: (timeZone: string) => void
  canRetrySync: boolean
  onRetrySync: () => void
  legacyPreview: LegacyProgressPreview
  onLegacyImport: () => void
}): JSX.Element {
  const [timeZoneDraft, setTimeZoneDraft] = useState(progress.timeZone)
  useEffect(() => {
    // Follow the account's canonical time zone after a successful cloud update.
    setTimeZoneDraft(progress.timeZone)
  }, [progress.timeZone])
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
      <section className="mastery-section account-time-zone">
        <h2>账户时区</h2>
        <p>学习日和连续记录按此 IANA 时区计算，例如 Asia/Shanghai。</p>
        <label htmlFor="account-time-zone-input">IANA 时区</label>
        <div>
          <input
            id="account-time-zone-input"
            value={timeZoneDraft}
            onChange={(event) => setTimeZoneDraft(event.currentTarget.value)}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="secondary-button"
            disabled={
              !timeZoneDraft.trim() || timeZoneDraft === progress.timeZone
            }
            onClick={() => onTimeZoneSave(timeZoneDraft.trim())}
          >
            保存时区
          </button>
        </div>
      </section>
      {canRetrySync && (
        <section className="mastery-section">
          <h2>云端同步失败</h2>
          <p>本机记录仍可用；网络恢复后可以安全重试同步。</p>
          <button
            type="button"
            className="secondary-button"
            onClick={onRetrySync}
          >
            重试同步
          </button>
        </section>
      )}
      <section className="mastery-section legacy-import-section">
        <h2>导入旧版学习记录</h2>
        {legacyPreview.status === 'empty' ? (
          <p>没有发现 v1 本地记录。</p>
        ) : legacyPreview.status === 'unavailable' ? (
          <p role="status">{legacyPreview.message}</p>
        ) : (
          <>
            <p>
              预览后由你选择是否导入。旧版包含{' '}
              {legacyPreview.progress.completed.length} 条阅读完成、
              {legacyPreview.progress.attempts.length} 条练习，其中{' '}
              {legacyPreview.selfRatedCount} 条自评分会标记为
              <code> legacy_self_reported</code>，不会计入客观正确率。
            </p>
            <ul>
              {legacyPreview.mappings.map((mapping) => (
                <li key={mapping.sourceId}>
                  <code>{mapping.sourceId}</code>
                  {mapping.targetId ? (
                    <span> → {mapping.targetId}（可导入）</span>
                  ) : (
                    <span> → 未知课程；保留在原始备份，不合并到当前进度</span>
                  )}
                </li>
              ))}
            </ul>
            <p>导入不会改写原 v1 数据；重复导入会按课程和练习去重。</p>
            <button
              type="button"
              className="secondary-button"
              onClick={onLegacyImport}
            >
              导入预览中的记录
            </button>
          </>
        )}
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
                      ? attempt.source === 'legacy_self_reported'
                        ? '历史导入练习 · legacy_self_reported'
                        : '本地客观练习'
                      : attempt.source === 'legacy_self_reported'
                        ? `历史自评 ${attempt.selfScore}/5 · legacy_self_reported`
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
