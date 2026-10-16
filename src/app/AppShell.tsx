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
import { lessons, tagLabel } from '../features/catalog'
import { summarizeProgress, type Progress } from '../features/learning'
import type { Lesson } from '../types/lesson'
import type { Route } from './router'
import type { Theme } from '../features/preferences'
import {
  browserStorageKey,
  readStoredValue,
  writeStoredValue,
} from '../lib/browserStorage'
import './readingFocus.css'

const READING_FOCUS_KEY = browserStorageKey('reading-focus')

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
            aria-label="打开课程目录"
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
        <nav className="top-nav" aria-label="主导航">
          <button
            className={route.page === 'home' ? 'selected' : ''}
            aria-current={route.page === 'home' ? 'page' : undefined}
            onClick={() => {
              // 从顶栏进入平台首页。
              return nav({ page: 'home' })
            }}
          >
            首页
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
            课程目录
          </button>
          <button
            className={route.page === 'search' ? 'selected' : ''}
            aria-current={route.page === 'search' ? 'page' : undefined}
            onClick={() => {
              // 打开只检索已公开课程内容的搜索页。
              return nav({ page: 'search' })
            }}
          >
            <Search size={13} /> 搜索
          </button>
          <button
            className={route.page === 'review' ? 'selected' : ''}
            aria-current={route.page === 'review' ? 'page' : undefined}
            onClick={() => nav({ page: 'review' })}
          >
            <RotateCcw size={13} /> 复习
          </button>
          <button
            className={route.page === 'progress' ? 'selected' : ''}
            aria-current={route.page === 'progress' ? 'page' : undefined}
            onClick={() => nav({ page: 'progress' })}
          >
            <Target size={13} /> 进度
          </button>
        </nav>
        <div className="topbar-right">
          <button
            className="theme-toggle"
            onClick={onToggleTheme}
            aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
            title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? '浅色' : '深色'}</span>
          </button>
          {hasLegacyWorkspace && (
            <button
              className="theme-toggle reading-focus-toggle"
              onClick={() => {
                // Keep a visible way to leave focus mode in every route.
                setReadingFocus((active) => !active)
              }}
              aria-pressed={readingFocus}
              aria-label={readingFocus ? '退出专注模式' : '进入专注模式'}
              title={readingFocus ? '退出专注模式' : '进入专注模式'}
            >
              <Eye size={15} />
              <span>{readingFocus ? '退出专注' : '专注模式'}</span>
            </button>
          )}
          {hasLegacyWorkspace && (
            <span className="status-live" role="status" title={saveStatus}>
              <i /> 本机记录
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
            aria-label="课程目录"
            className={`sidebar ${drawer ? 'drawer-open' : ''}`}
          >
            <div className="drawer-head">
              <span>学习路线</span>
              <button
                className="icon-button"
                aria-label="关闭课程目录"
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
                <strong>Rust 工程路线</strong>
                <small>学习路线 · {lessons.length} 节</small>
              </div>
            </div>
            <div className="side-progress">
              <div className="side-progress-label">
                <span>你的进度</span>
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
              课程目录{' '}
              <button
                onClick={() => {
                  // 切换目录展开状态。
                  return setShowAll((v) => {
                    // 反转最新的展开状态。
                    return !v
                  })
                }}
              >
                {showAll ? '收起' : '展开'}
              </button>
            </div>
            {showAll && (
              <nav className="lesson-nav" aria-label="Rust 学习路线">
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
                      title={lesson.title}
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
                      <span className="lesson-name">{lesson.title}</span>
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
                薄弱点复习
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
                学习统计
              </button>
            </div>
          </aside>
        )}
        {hasLegacyWorkspace && drawer && (
          <button
            className="drawer-scrim"
            aria-label="关闭课程目录"
            onClick={() => {
              // 点击遮罩关闭目录。
              return setDrawer(false)
            }}
          />
        )}

        <main
          className={`main-content ${hasLegacyWorkspace ? '' : 'main-content-wide'}`}
        >
          {/失败|损坏|不可用|无法识别/.test(saveStatus) && (
            <p className="save-warning" role="alert">
              {saveStatus}
            </p>
          )}
          {children}
        </main>

        {hasLegacyWorkspace && (
          <aside className="right-rail">
            <div className="rail-title">
              学习概览 <span className="sparkle">✳</span>
            </div>
            <div className="overview-card">
              <div className="overview-heading">
                <span>课程进度</span>
                <span className="mini-icon orange">
                  <BookOpen size={15} />
                </span>
              </div>
              <div className="metric-line">
                <strong>{completedCount}</strong>
                <span>/ {lessons.length} 节课</span>
              </div>
              <div className="progress-track large">
                <span
                  style={{
                    width: `${(completedCount / lessons.length) * 100}%`,
                  }}
                />
              </div>
              <small>还有 {lessons.length - completedCount} 节课等待探索</small>
            </div>
            <div className="stat-pair">
              <div className="stat-card">
                <div className="overview-heading">
                  <span>客观题正确率</span>
                  <span className="mini-icon green">
                    <Target size={14} />
                  </span>
                </div>
                <strong>{accuracy !== null ? `${accuracy}%` : '—'}</strong>
                <small>{answered} 道已作答</small>
              </div>
              <div className="stat-card">
                <div className="overview-heading">
                  <span>连续学习</span>
                  <span className="mini-icon amber">
                    <Flame size={14} />
                  </span>
                </div>
                <strong>
                  {progress.streak}
                  <em> 天</em>
                </strong>
                <small>
                  {progress.streak ? '保持这个节奏' : '今天开始你的 streak'}
                </small>
              </div>
            </div>
            <div className="overview-card level-card">
              <div className="overview-heading">
                <span>当前等级</span>
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
              <small>{completedCount % 4}/4 课程至下一等级</small>
            </div>
            <div className="weak-panel">
              <div className="overview-heading">
                <span>值得再看</span>
                <button
                  onClick={() => {
                    // 查看全部薄弱点练习。
                    return nav({ page: 'review' })
                  }}
                  className="text-link"
                >
                  全部 <ArrowRight size={12} />
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
                      <span>{tagLabel(tag)}</span>
                      <span className="weak-level">
                        {score > 3 ? '需加强' : score > 1 ? '练习中' : '待巩固'}
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
                    目前没有薄弱知识点
                    <br />
                    <small>答错的题目会显示在这里</small>
                  </span>
                </div>
              )}
            </div>
            <div className="rail-tip">
              <span className="tip-icon">
                <Sparkles size={14} />
              </span>
              <p>学习建议</p>
              <small>
                {weakTags.length
                  ? `试试复习 ${tagLabel(weakTags[0][0])}，巩固刚才的知识。`
                  : '每天完成一节短课，逐步搭建 Rust 心智模型。'}
              </small>
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
