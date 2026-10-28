import type { JSX } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Circle,
  Flame,
  Eye,
  Menu,
  Moon,
  RotateCcw,
  Search,
  Sparkles,
  Sun,
  Target,
  X,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { tagLabel } from '../features/catalog'
import { getLessons } from '../data/localizedLessons'
import { summarizeProgress, type Progress } from '../features/learning'
import type { Lesson } from '../types/lesson'
import type { Route } from './router'
import { useLanguage, type Theme } from '../features/preferences'
import {
  browserStorageKey,
  readStoredValue,
  writeStoredValue,
} from '../lib/browserStorage'
import './readingFocus.css'
import { legacyLessonTitle } from '../data/courseText'

const READING_FOCUS_KEY = browserStorageKey('reading-focus')
const progressStatusEn: Record<string, string> = {
  '本地练习 · 尚无学习记录': 'Local practice · no records yet',
  '本地存储不可用，本次进度仅在内存中保留':
    'Browser storage unavailable; progress is kept in memory for this session.',
  '本地保存失败，本次进度仅在内存中保留':
    'Saving failed; progress is kept in memory for this session.',
  旧版本地进度已读取: 'Previous local progress restored.',
  本地进度已恢复: 'Local progress restored.',
  '本地记录无法识别，原数据已保留；本次进度仅在内存中保留':
    'The saved record could not be read. The original data is preserved; this session stays in memory.',
  进度保存在此浏览器: 'Progress saved in this browser.',
  本站学习记录已清空: 'Learning records cleared.',
  '记录已在本次会话清空；浏览器存储不可用':
    'Records cleared for this session; browser storage is unavailable.',
}

/** Restore the optional focus layout without making storage availability a requirement. */
function readReadingFocus(): boolean {
  const result = readStoredValue(READING_FOCUS_KEY)
  return result.ok && result.value === 'true'
}

/** 组合原型导航、学习概览与页面内容；抽屉状态只属于布局。 */
export function AppShell({
  progress,
  route,
  current,
  theme,
  onToggleTheme,
  onNavigate,
  saveStatus,
  children,
}: {
  progress: Progress
  route: Route
  current: Lesson
  theme: Theme
  onToggleTheme: () => void
  onNavigate: (route: Route) => void
  saveStatus: string
  children: ReactNode
}): JSX.Element {
  const { language, setLanguage, t } = useLanguage()
  const lessons = getLessons(language)
  const displayedSaveStatus =
    language === 'zh'
      ? saveStatus
      : (progressStatusEn[saveStatus] ?? saveStatus)
  const [drawer, setDrawer] = useState(false)
  const [showAll, setShowAll] = useState(true)
  const [readingFocus, setReadingFocus] = useState(readReadingFocus)
  const sidebar = useRef<HTMLElement>(null)
  useEffect(() => {
    // Focus layout is a lightweight preference; storage errors leave the current UI usable.
    writeStoredValue(READING_FOCUS_KEY, String(readingFocus))
  }, [readingFocus])
  useEffect(() => {
    // 移动抽屉打开时约束键盘焦点，关闭或卸载后恢复触发控件。
    if (!drawer) return
    const previous = document.activeElement
    const panel = sidebar.current
    if (!panel) return
    panel.focus()
    /** Escape 关闭目录，Tab 在当前可见导航控件间循环。 */
    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setDrawer(false)
      if (event.key !== 'Tab' || !panel) return
      const controls = Array.from(
        panel.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]'),
      ).filter((element) => {
        // 收起或隐藏的导航项不能成为焦点陷阱的一部分。
        return element.getClientRects().length > 0
      })
      const first = controls[0]
      const last = controls[controls.length - 1]
      if (!first || !last) return
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === panel)
      ) {
        event.preventDefault()
        last.focus()
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || document.activeElement === panel)
      ) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      // 不遗留全局监听；触发按钮仍存在时恢复键盘位置。
      document.removeEventListener('keydown', handleKey)
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus()
    }
  }, [drawer])
  const { completedCount, answered, accuracy, weakTags } =
    summarizeProgress(progress)
  const hasLegacyWorkspace = route.page === 'lesson'
  /** 关闭移动目录后导航到目标页面。 */
  const nav = (target: Route): void => {
    setDrawer(false)
    onNavigate(target)
  }
  /** 将课程选择转换为路由意图。 */
  const selectLesson = (lesson: Lesson): void => {
    nav({ page: 'lesson', lessonId: lesson.id })
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        {hasLegacyWorkspace && (
          <button
            className="icon-button mobile-menu"
            aria-label={t('打开课程目录', 'Open course catalog')}
            aria-expanded={drawer}
            aria-controls="course-sidebar"
            onClick={() => {
              // 打开移动端课程目录。
              return setDrawer(true)
            }}
          >
            <Menu size={18} />
          </button>
        )}
        <button
          className="brand"
          onClick={() => {
            // 品牌入口返回平台首页，不改写学习进度。
            return nav({ page: 'home' })
          }}
        >
          <span className="brand-mark">R</span>
          <span>
            rust<span className="brand-light">.path</span>
          </span>
        </button>
        <div className="topbar-divider" />
        <nav className="top-nav" aria-label={t('主导航', 'Main navigation')}>
          <button
            className={route.page === 'home' ? 'selected' : ''}
            aria-current={route.page === 'home' ? 'page' : undefined}
            onClick={() => {
              // 从顶栏进入平台首页。
              return nav({ page: 'home' })
            }}
          >
            {t('首页', 'Home')}
          </button>
          <button
            className={
              route.page === 'track' ||
              route.page === 'course-lesson' ||
              route.page === 'public-course-lesson'
                ? 'selected'
                : ''
            }
            aria-current={
              route.page === 'track' ||
              route.page === 'course-lesson' ||
              route.page === 'public-course-lesson'
                ? 'page'
                : undefined
            }
            onClick={() => {
              // Open the full course catalog from the main navigation.
              return nav({ page: 'track', trackSlug: 'rust-backend' })
            }}
          >
            {t('课程目录', 'Courses')}
          </button>
          <button
            className={route.page === 'search' ? 'selected' : ''}
            aria-current={route.page === 'search' ? 'page' : undefined}
            onClick={() => {
              // 打开只检索已公开课程内容的搜索页。
              return nav({ page: 'search' })
            }}
          >
            <Search size={13} /> {t('搜索', 'Search')}
          </button>
          <button
            className={route.page === 'review' ? 'selected' : ''}
            aria-current={route.page === 'review' ? 'page' : undefined}
            onClick={() => nav({ page: 'review' })}
          >
            <RotateCcw size={13} /> {t('复习', 'Review')}
          </button>
          <button
            className={route.page === 'progress' ? 'selected' : ''}
            aria-current={route.page === 'progress' ? 'page' : undefined}
            onClick={() => nav({ page: 'progress' })}
          >
            <Target size={13} /> {t('进度', 'Progress')}
          </button>
        </nav>
        <div className="topbar-right">
          <select
            className="theme-toggle language-select"
            aria-label={t('语言', 'Language')}
            value={language}
            onChange={(event) =>
              setLanguage(event.currentTarget.value as 'zh' | 'en')
            }
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={
              theme === 'dark'
                ? t('切换到浅色主题', 'Switch to light theme')
                : t('切换到深色主题', 'Switch to dark theme')
            }
            title={
              theme === 'dark'
                ? t('切换到浅色主题', 'Switch to light theme')
                : t('切换到深色主题', 'Switch to dark theme')
            }
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>
              {theme === 'dark' ? t('浅色', 'Light') : t('深色', 'Dark')}
            </span>
          </button>
          {hasLegacyWorkspace && (
            <button
              className="theme-toggle reading-focus-toggle"
              onClick={() => {
                // Keep a visible way to leave focus mode in every route.
                setReadingFocus((active) => !active)
              }}
              aria-pressed={readingFocus}
              aria-label={
                readingFocus
                  ? t('退出专注模式', 'Exit focus mode')
                  : t('进入专注模式', 'Enter focus mode')
              }
              title={
                readingFocus
                  ? t('退出专注模式', 'Exit focus mode')
                  : t('进入专注模式', 'Enter focus mode')
              }
            >
              <Eye size={15} />
              <span>
                {readingFocus
                  ? t('退出专注', 'Exit focus')
                  : t('专注模式', 'Focus mode')}
              </span>
            </button>
          )}
          {hasLegacyWorkspace && (
            <span
              className="status-live"
              role="status"
              title={displayedSaveStatus}
            >
              <i /> {t('本机记录', 'Local record')}
            </span>
          )}
          <a
            className="theme-toggle"
            href="https://github.com/liulewis67-ops/rust_training"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </header>
      <div
        className={`app-grid ${hasLegacyWorkspace ? '' : 'app-grid-simple'} ${readingFocus ? 'app-grid-reading-focus' : ''}`}
      >
        {hasLegacyWorkspace && (
          <aside
            ref={sidebar}
            id="course-sidebar"
            tabIndex={-1}
            role={drawer ? 'dialog' : undefined}
            aria-modal={drawer || undefined}
            aria-label={t('课程目录', 'Course catalog')}
            className={`sidebar ${drawer ? 'drawer-open' : ''}`}
          >
            <div className="drawer-head">
              <span>{t('学习路线', 'Learning path')}</span>
              <button
                className="icon-button"
                aria-label={t('关闭课程目录', 'Close course catalog')}
                onClick={() => {
                  // 关闭移动端课程目录。
                  return setDrawer(false)
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="path-heading">
              <div className="path-icon">⌘</div>
              <div>
                <strong>{t('Rust 工程路线', 'Rust engineering path')}</strong>
                <small>
                  {t('学习路线', 'Learning path')} · {lessons.length}{' '}
                  {t('节', 'lessons')}
                </small>
              </div>
            </div>
            <div className="side-progress">
              <div className="side-progress-label">
                <span>{t('你的进度', 'Your progress')}</span>
                <b>
                  {completedCount} / {lessons.length}
                </b>
              </div>
              <div className="progress-track">
                <span
                  style={{
                    width: `${(completedCount / lessons.length) * 100}%`,
                  }}
                />
              </div>
            </div>
            <div className="section-label">
              {t('课程目录', 'Course catalog')}{' '}
              <button
                onClick={() => {
                  // 切换目录展开状态。
                  return setShowAll((v) => {
                    // 反转最新的展开状态。
                    return !v
                  })
                }}
              >
                {showAll ? t('收起', 'Collapse') : t('展开', 'Expand')}
              </button>
            </div>
            {showAll && (
              <nav
                className="lesson-nav"
                aria-label={t('Rust 学习路线', 'Rust learning path')}
              >
                {lessons.map((lesson) => {
                  // 按课程完成与当前选中状态渲染导航项。

                  const isComplete = progress.completed.includes(lesson.id),
                    active = route.page === 'lesson' && current.id === lesson.id
                  return (
                    <button
                      key={lesson.id}
                      onClick={() => {
                        // 导航到用户选中的课程。
                        return selectLesson(lesson)
                      }}
                      className={`lesson-nav-item ${active ? 'active' : ''}`}
                      title={legacyLessonTitle(
                        lesson.id,
                        language,
                        lesson.title,
                      )}
                    >
                      <span
                        className={`lesson-state ${isComplete ? 'is-complete' : active ? 'is-current' : ''}`}
                      >
                        {isComplete ? (
                          <Check size={12} />
                        ) : active ? (
                          <span />
                        ) : (
                          <Circle size={13} />
                        )}
                      </span>
                      <span className="lesson-number">
                        {String(lesson.order).padStart(2, '0')}
                      </span>
                      <span className="lesson-name">
                        {legacyLessonTitle(lesson.id, language, lesson.title)}
                      </span>
                      {active && (
                        <ChevronRight size={13} className="active-chevron" />
                      )}
                    </button>
                  )
                })}
              </nav>
            )}
            <div className="sidebar-bottom">
              <button
                className="side-link"
                onClick={() => {
                  // 打开薄弱点复习页。
                  return nav({ page: 'review' })
                }}
              >
                <RotateCcw size={15} />
                {t('薄弱点复习', 'Review weak areas')}
                {weakTags.length > 0 && (
                  <span className="weak-count">{weakTags.length}</span>
                )}
              </button>
              <button
                className="side-link"
                onClick={() => {
                  // 打开学习统计页。
                  return nav({ page: 'progress' })
                }}
              >
                <Target size={15} />
                {t('学习统计', 'Learning stats')}
              </button>
            </div>
          </aside>
        )}
        {hasLegacyWorkspace && drawer && (
          <button
            className="drawer-scrim"
            aria-label={t('关闭课程目录', 'Close course catalog')}
            onClick={() => {
              // 点击遮罩关闭目录。
              return setDrawer(false)
            }}
          />
        )}

        <main
          className={`main-content ${hasLegacyWorkspace ? '' : 'main-content-wide'} ${route.page === 'course-lesson' ? 'main-content-course' : ''}`}
        >
          {/失败|损坏|不可用|无法识别/.test(saveStatus) && (
            <p className="save-warning" role="alert">
              {displayedSaveStatus}
            </p>
          )}
          {children}
        </main>

        {hasLegacyWorkspace && (
          <aside className="right-rail">
            <div className="rail-title">
              {t('学习概览', 'Learning overview')}{' '}
              <span className="sparkle">✳</span>
            </div>
            <div className="overview-card">
              <div className="overview-heading">
                <span>{t('课程进度', 'Course progress')}</span>
                <span className="mini-icon orange">
                  <BookOpen size={15} />
                </span>
              </div>
              <div className="metric-line">
                <strong>{completedCount}</strong>
                <span>
                  / {lessons.length} {t('节课', 'lessons')}
                </span>
              </div>
              <div className="progress-track large">
                <span
                  style={{
                    width: `${(completedCount / lessons.length) * 100}%`,
                  }}
                />
              </div>
              <small>
                {t(
                  `还有 ${lessons.length - completedCount} 节课等待探索`,
                  `${lessons.length - completedCount} lessons left to explore`,
                )}
              </small>
            </div>
            <div className="stat-pair">
              <div className="stat-card">
                <div className="overview-heading">
                  <span>{t('客观题正确率', 'Quiz accuracy')}</span>
                  <span className="mini-icon green">
                    <Target size={14} />
                  </span>
                </div>
                <strong>{accuracy !== null ? `${accuracy}%` : '—'}</strong>
                <small>
                  {answered} {t('道已作答', 'answered')}
                </small>
              </div>
              <div className="stat-card">
                <div className="overview-heading">
                  <span>{t('连续学习', 'Study streak')}</span>
                  <span className="mini-icon amber">
                    <Flame size={14} />
                  </span>
                </div>
                <strong>
                  {progress.streak}
                  <em> {t('天', 'days')}</em>
                </strong>
                <small>
                  {progress.streak
                    ? t('保持这个节奏', 'Keep it going')
                    : t('今天开始你的 streak', 'Start your streak today')}
                </small>
              </div>
            </div>
            <div className="overview-card level-card">
              <div className="overview-heading">
                <span>{t('当前等级', 'Current level')}</span>
                <span className="level-badge">
                  LVL 0{Math.min(9, 1 + Math.floor(completedCount / 4))}
                </span>
              </div>
              <strong>
                {completedCount < 4
                  ? 'Rust Explorer'
                  : completedCount < 12
                    ? 'Backend Builder'
                    : 'Infra Architect'}
              </strong>
              <div className="level-progress">
                <span
                  style={{ width: `${((completedCount % 4) / 4) * 100}%` }}
                />
              </div>
              <small>
                {completedCount % 4}/4{' '}
                {t('课程至下一等级', 'lessons to next level')}
              </small>
            </div>
            <div className="weak-panel">
              <div className="overview-heading">
                <span>{t('值得再看', 'Worth revisiting')}</span>
                <button
                  onClick={() => {
                    // 查看全部薄弱点练习。
                    return nav({ page: 'review' })
                  }}
                  className="text-link"
                >
                  {t('全部', 'All')} <ArrowRight size={12} />
                </button>
              </div>
              {weakTags.length ? (
                weakTags.map(([tag, score]) => {
                  // 显示仍需巩固的知识点与错误程度。
                  return (
                    <button
                      className="weak-item"
                      key={tag}
                      onClick={() => {
                        // 从知识点建议进入复习页。
                        return nav({ page: 'review' })
                      }}
                    >
                      <span className="weak-dot" />
                      <span>{tagLabel(tag, language)}</span>
                      <span className="weak-level">
                        {score > 3
                          ? t('需加强', 'Needs work')
                          : score > 1
                            ? t('练习中', 'Practicing')
                            : t('待巩固', 'Review')}
                      </span>
                    </button>
                  )
                })
              ) : (
                <div className="empty-weak">
                  <span className="empty-check">
                    <Check size={12} />
                  </span>
                  <span>
                    {t('目前没有薄弱知识点', 'No weak areas yet')}
                    <br />
                    <small>
                      {t(
                        '答错的题目会显示在这里',
                        'Missed questions will appear here',
                      )}
                    </small>
                  </span>
                </div>
              )}
            </div>
            <div className="rail-tip">
              <span className="tip-icon">
                <Sparkles size={14} />
              </span>
              <p>{t('学习建议', 'Study tip')}</p>
              <small>
                {weakTags.length
                  ? t(
                      `试试复习 ${tagLabel(weakTags[0][0])}，巩固刚才的知识。`,
                      `Review ${tagLabel(weakTags[0][0], language)} to strengthen your understanding.`,
                    )
                  : t(
                      '每天完成一节短课，逐步搭建 Rust 心智模型。',
                      'Complete one short lesson each day to build your Rust mental model.',
                    )}
              </small>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
