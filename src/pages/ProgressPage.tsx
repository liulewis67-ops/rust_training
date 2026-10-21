import type { JSX } from 'react'
import { Check, ChevronRight, Flame, Trash2, X } from 'lucide-react'
import { getLessons } from '../data/localizedLessons'
import { courseModules } from '../data/courseCatalog'
import { listPublicCourseLessons } from '../data/publicCourse'
import { summarizeProgress } from '../features/learning'
import type { Progress } from '../features/learning'
import { useLanguage } from '../features/preferences'
import { legacyLessonTitle, moduleText } from '../data/courseText'

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
  const { language, t } = useLanguage()
  const lessons = getLessons(language)
  const publishedModules = courseModules
    .map((module) => {
      const released = module.lessons.filter((lesson) => lesson.published)
      return {
        label: `${module.id} · ${moduleText(module.id, language, 'title', module.title)}`,
        complete: released.filter((lesson) =>
          progress.completed.includes(`${module.id}-${lesson.id}`),
        ).length,
        total: released.length,
      }
    })
    .filter((module) => module.total > 0)
  const publicLessons = listPublicCourseLessons()
  const publishedStats = [
    ...publishedModules,
    {
      label: t('公开专题', 'Public course pack'),
      complete: publicLessons.filter((lesson) =>
        progress.completed.includes(`public:${lesson.id}`),
      ).length,
      total: publicLessons.length,
    },
  ].filter((item) => item.total > 0)
  const mainCompleted = publishedModules.reduce(
    (total, module) => total + module.complete,
    0,
  )
  const mainTotal = publishedModules.reduce(
    (total, module) => total + module.total,
    0,
  )
  const recent = [...progress.attempts].reverse().slice(0, 8)
  const summary = summarizeProgress(progress)

  /** Ask before removing the progress stored for this project in this browser. */
  function clearAfterConfirmation(): void {
    if (
      window.confirm(
        t(
          '清空本站保存在此浏览器中的学习记录？',
          'Clear learning records saved by this site in this browser?',
        ),
      )
    )
      onClear()
  }

  return (
    <div className="utility-page">
      <div className="breadcrumb">
        <span>{t('学习工具', 'Learning tools')}</span>
        <ChevronRight size={13} />
        <span>{t('学习进度', 'Learning progress')}</span>
      </div>
      <div className="utility-title-row">
        <div>
          <span className="utility-eyebrow">LOCAL PROGRESS</span>
          <h1>{t('学习进度', 'Learning progress')}</h1>
          <p>
            {t(
              '这些记录由你自行标记，只保存在当前浏览器。',
              'You mark these records yourself; they are stored only in this browser.',
            )}
          </p>
        </div>
        <div className="review-count">
          <Flame size={17} />
          <b>{progress.streak}</b>
          <small>{t('天有学习记录', 'study days')}</small>
        </div>
      </div>
      <div className="progress-summary">
        <div>
          <small>{t('主线已发布课节', 'Published core lessons')}</small>
          <strong>
            {mainCompleted}
            <em> / {mainTotal}</em>
          </strong>
        </div>
        <div>
          <small>{t('已答题目', 'Questions answered')}</small>
          <strong>{summary.answered}</strong>
        </div>
        <div>
          <small>{t('客观题练习正确率', 'Quiz accuracy')}</small>
          <strong>{accuracy !== null ? `${accuracy}%` : '—'}</strong>
        </div>
      </div>
      <section className="mastery-section">
        <h2>{t('已发布内容', 'Published content')}</h2>
        <p>
          {t(
            '这里只统计可阅读的课节与专题；完成状态来自本地自报，不代表能力认证。',
            'Only readable lessons and course packs are counted. Completion is self reported locally and does not certify skill.',
          )}
        </p>
        {publishedStats.map((item) => (
          <div className="mastery-row" key={item.label}>
            <span>{item.label}</span>
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
        <h2>{t('最近练习', 'Recent practice')}</h2>
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
                  <b>
                    {lesson
                      ? legacyLessonTitle(lesson.id, language, lesson.title)
                      : attempt.lessonId}
                  </b>
                  <small>
                    {attempt.exerciseId} ·{' '}
                    {t('本地练习记录', 'Local practice record')}
                  </small>
                </div>
                <time>
                  {new Date(attempt.at).toLocaleDateString(
                    language === 'zh' ? 'zh-CN' : 'en-US',
                    {
                      month: 'short',
                      day: 'numeric',
                    },
                  )}
                </time>
              </div>
            )
          })
        ) : (
          <div className="no-attempts">
            {t(
              '完成一道题后，最近练习会显示在这里。',
              'Your recent practice will appear here after you answer a question.',
            )}
          </div>
        )}
      </section>
      <section className="mastery-section local-record-actions">
        <h2>{t('本地记录', 'Local records')}</h2>
        <p>
          {t(
            '记录可能因清理浏览器数据、更换设备或浏览器限制而丢失。课程无需记录即可使用。',
            'Records may be lost if you clear browser data, change devices, or browser storage is restricted. Lessons work without records.',
          )}
        </p>
        <button
          type="button"
          className="secondary-button"
          onClick={clearAfterConfirmation}
        >
          <Trash2 size={14} /> {t('清空本站学习记录', 'Clear learning records')}
        </button>
      </section>
    </div>
  )
}
