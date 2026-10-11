import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Code2,
  Copy,
  Flame,
  Menu,
  Moon,
  RotateCcw,
  Sparkles,
  Sun,
  Target,
  X,
  XCircle,
} from 'lucide-react'
import { lessons } from '../data/lessons'
import {
  allExercises,
  loadProgress,
  recordActivity,
  saveProgress,
  type Attempt,
  type Progress,
} from '../lib/storage'
import type { Exercise, Lesson } from '../types/lesson'

type Route = { page: 'lesson' | 'review' | 'progress'; lessonId?: string }
const readRoute = (): Route => {
  const path = location.pathname.split('/').filter(Boolean)
  if (path[0] === 'review') return { page: 'review' }
  if (path[0] === 'progress') return { page: 'progress' }
  return { page: 'lesson', lessonId: path[1] || 'ownership' }
}
const go = (url: string) => {
  history.pushState({}, '', url)
  window.dispatchEvent(new PopStateEvent('popstate'))
}
const difficultyLabel = {
  beginner: '入门',
  intermediate: '进阶',
  advanced: '高级',
}
const dateText = (date: string) =>
  new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
type Theme = 'dark' | 'light'
const readTheme = (): Theme => {
  try {
    return localStorage.getItem('rust-backend-training:theme') === 'light'
      ? 'light'
      : 'dark'
  } catch {
    return 'dark'
  }
}

export default function App() {
  const [progress, setProgress] = useState<Progress>(loadProgress)
  const [route, setRoute] = useState<Route>(() => {
    const initialRoute = readRoute()
    if (location.pathname === '/')
      initialRoute.lessonId = loadProgress().currentLesson
    return initialRoute
  })
  const [theme, setTheme] = useState<Theme>(readTheme)
  const [drawer, setDrawer] = useState(false)
  const [showAll, setShowAll] = useState(true)
  useEffect(() => {
    const handler = () => setRoute(readRoute())
    window.addEventListener('popstate', handler)
    return () => window.removeEventListener('popstate', handler)
  }, [])
  useEffect(() => {
    saveProgress(progress)
  }, [progress])
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('rust-backend-training:theme', theme)
    } catch {
      /* Theme still applies for this session. */
    }
  }, [theme])
  useEffect(() => {
    if (route.page !== 'lesson') return
    const requested =
      lessons.find((item) => item.id === route.lessonId) ?? lessons[0]
    setProgress((value) =>
      value.currentLesson === requested.id
        ? value
        : { ...value, currentLesson: requested.id },
    )
  }, [route.page, route.lessonId])
  const current =
    lessons.find((item) => item.id === route.lessonId) ?? lessons[0]
  const exercises = useMemo(
    () =>
      allExercises(
        current.exercises,
        current.comparisonQuestion,
        current.challenge,
      ),
    [current],
  )
  const completedCount = progress.completed.length
  const answered = progress.attempts.length
  const correct = progress.attempts.filter((item) => item.correct).length
  const accuracy = answered ? Math.round((correct / answered) * 100) : 0
  const weakTags = Object.entries(progress.weakness)
    .sort((a, b) => b[1] - a[1])
    .filter(([, score]) => score > 0)
    .slice(0, 4)
  const selectLesson = (lesson: Lesson) => {
    setDrawer(false)
    setProgress((p) => ({ ...p, currentLesson: lesson.id }))
    go(`/lesson/${lesson.id}`)
  }
  const saveAttempt = (
    exercise: Exercise,
    answer: string | number,
    correctAnswer: boolean,
    selfScore?: number,
  ) => {
    const activity = recordActivity(progress)
    const attempt: Attempt = {
      exerciseId: exercise.id,
      lessonId: current.id,
      correct: correctAnswer,
      answer,
      selfScore,
      at: new Date().toISOString(),
    }
    setProgress((p) => {
      const weakness = { ...p.weakness }
      for (const tag of exercise.tags)
        weakness[tag] = Math.max(
          0,
          (weakness[tag] ?? 0) + (correctAnswer ? -1 : 1),
        )
      return {
        ...p,
        ...activity,
        attempts: [
          ...p.attempts.filter((a) => a.exerciseId !== exercise.id),
          attempt,
        ],
        weakness,
      }
    })
  }
  const completeLesson = () => {
    const activity = recordActivity(progress)
    setProgress((p) => ({
      ...p,
      ...activity,
      currentLesson: current.id,
      completed: Array.from(new Set([...p.completed, current.id])),
    }))
  }
  const nav = (target: Route) => {
    setDrawer(false)
    go(
      target.page === 'lesson'
        ? `/lesson/${target.lessonId ?? 'ownership'}`
        : `/${target.page}`,
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          className="icon-button mobile-menu"
          aria-label="打开课程目录"
          onClick={() => setDrawer(true)}
        >
          <Menu size={18} />
        </button>
        <button
          className="brand"
          onClick={() => nav({ page: 'lesson', lessonId: 'ownership' })}
        >
          <span className="brand-mark">R</span>
          <span>
            rust<span className="brand-light">.path</span>
          </span>
        </button>
        <div className="topbar-divider" />
        <span className="workspace-label">Backend Engineer Track</span>
        <div className="topbar-right">
          <button
            className="theme-toggle"
            onClick={() =>
              setTheme((value) => (value === 'dark' ? 'light' : 'dark'))
            }
            aria-label={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
            title={theme === 'dark' ? '切换到浅色主题' : '切换到深色主题'}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            <span>{theme === 'dark' ? '浅色' : '深色'}</span>
          </button>
          <span className="status-live">
            <i /> 本地进度已保存
          </span>
          <div className="avatar">L</div>
        </div>
      </header>
      <div className="app-grid">
        <aside className={`sidebar ${drawer ? 'drawer-open' : ''}`}>
          <div className="drawer-head">
            <span>学习路线</span>
            <button className="icon-button" onClick={() => setDrawer(false)}>
              <X size={18} />
            </button>
          </div>
          <div className="path-heading">
            <div className="path-icon">⌘</div>
            <div>
              <strong>Rust Backend</strong>
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
                style={{ width: `${(completedCount / lessons.length) * 100}%` }}
              />
            </div>
          </div>
          <div className="section-label">
            课程目录{' '}
            <button onClick={() => setShowAll((v) => !v)}>
              {showAll ? '收起' : '展开'}
            </button>
          </div>
          {showAll && (
            <nav className="lesson-nav" aria-label="Rust 学习路线">
              {lessons.map((lesson) => {
                const isComplete = progress.completed.includes(lesson.id),
                  active = route.page === 'lesson' && current.id === lesson.id
                return (
                  <button
                    key={lesson.id}
                    onClick={() => selectLesson(lesson)}
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
              className={`side-link ${route.page === 'review' ? 'selected' : ''}`}
              onClick={() => nav({ page: 'review' })}
            >
              <RotateCcw size={15} />
              薄弱点复习
              {weakTags.length > 0 && (
                <span className="weak-count">{weakTags.length}</span>
              )}
            </button>
            <button
              className={`side-link ${route.page === 'progress' ? 'selected' : ''}`}
              onClick={() => nav({ page: 'progress' })}
            >
              <Target size={15} />
              学习统计
            </button>
          </div>
        </aside>
        {drawer && (
          <button
            className="drawer-scrim"
            aria-label="关闭课程目录"
            onClick={() => setDrawer(false)}
          />
        )}

        <main className="main-content">
          {route.page === 'lesson' ? (
            <LessonView
              key={current.id}
              lesson={current}
              progress={progress}
              exercises={exercises}
              onAttempt={saveAttempt}
              onComplete={completeLesson}
              onNavigate={selectLesson}
              onReview={() => nav({ page: 'review' })}
            />
          ) : route.page === 'review' ? (
            <ReviewView
              progress={progress}
              lessons={lessons}
              onAttempt={(lesson, exercise, answer, isCorrect, score) => {
                setProgress((p) => {
                  const activity = recordActivity(p)
                  const weakness = { ...p.weakness }
                  exercise.tags.forEach(
                    (tag) =>
                      (weakness[tag] = Math.max(
                        0,
                        (weakness[tag] ?? 0) + (isCorrect ? -1 : 1),
                      )),
                  )
                  return {
                    ...p,
                    ...activity,
                    weakness,
                    attempts: [
                      ...p.attempts,
                      {
                        exerciseId: exercise.id,
                        lessonId: lesson.id,
                        answer,
                        correct: isCorrect,
                        selfScore: score,
                        at: new Date().toISOString(),
                      },
                    ],
                  }
                })
              }}
              onNavigate={selectLesson}
            />
          ) : (
            <ProgressView progress={progress} accuracy={accuracy} />
          )}
        </main>

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
                style={{ width: `${(completedCount / lessons.length) * 100}%` }}
              />
            </div>
            <small>还有 {lessons.length - completedCount} 节课等待探索</small>
          </div>
          <div className="stat-pair">
            <div className="stat-card">
              <div className="overview-heading">
                <span>正确率</span>
                <span className="mini-icon green">
                  <Target size={14} />
                </span>
              </div>
              <strong>{answered ? `${accuracy}%` : '—'}</strong>
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
              <span style={{ width: `${((completedCount % 4) / 4) * 100}%` }} />
            </div>
            <small>{completedCount % 4}/4 课程至下一等级</small>
          </div>
          <div className="weak-panel">
            <div className="overview-heading">
              <span>值得再看</span>
              <button
                onClick={() => nav({ page: 'review' })}
                className="text-link"
              >
                全部 <ArrowRight size={12} />
              </button>
            </div>
            {weakTags.length ? (
              weakTags.map(([tag, score]) => (
                <button
                  className="weak-item"
                  key={tag}
                  onClick={() => nav({ page: 'review' })}
                >
                  <span className="weak-dot" />
                  <span>{tagLabel(tag)}</span>
                  <span className="weak-level">
                    {score > 3 ? '需加强' : score > 1 ? '练习中' : '待巩固'}
                  </span>
                </button>
              ))
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
      </div>
    </div>
  )
}

function tagLabel(tag: string) {
  return (
    (
      {
        ownership: '所有权',
        borrowing: '借用',
        'mutable-borrowing': '可变借用',
        lifetime: '生命周期',
        traits: 'Trait',
        generics: '泛型',
        'dynamic-dispatch': '动态分发',
        'error-handling': '错误处理',
        result: 'Result',
        concurrency: '并发',
        async: '异步',
        tokio: 'Tokio',
        database: '数据库',
        'agent-runtime': 'Agent Runtime',
        'java-go': '跨语言对比',
        'copy-clone': 'Copy / Clone',
        'resource-lifecycle': '资源生命周期',
        'string-slice': '&str / String',
        'memory-safety': '内存安全',
        'api-design': 'API 设计',
        web: 'Web 后端',
      } as Record<string, string>
    )[tag] ?? tag
  )
}

function LessonView({
  lesson,
  progress,
  exercises,
  onAttempt,
  onComplete,
  onNavigate,
  onReview,
}: {
  lesson: Lesson
  progress: Progress
  exercises: Exercise[]
  onAttempt: (
    exercise: Exercise,
    answer: string | number,
    correct: boolean,
    score?: number,
  ) => void
  onComplete: () => void
  onNavigate: (lesson: Lesson) => void
  onReview: () => void
}) {
  const [activeExercise, setActiveExercise] = useState(0)
  const [copied, setCopied] = useState(false)
  const done = progress.completed.includes(lesson.id)
  const exercise = exercises[activeExercise]
  const allAnswered = exercises.every((item) =>
    progress.attempts.some((attempt) => attempt.exerciseId === item.id),
  )
  const existing = progress.attempts.find(
    (item) => item.exerciseId === exercise?.id,
  )
  return (
    <>
      <div className="lesson-heading">
        <div className="breadcrumb">
          <span>Rust Backend Path</span>
          <ChevronRight size={13} />
          <span>{lesson.category}</span>
        </div>
        <div className="lesson-meta">
          <span className="lesson-index">
            LESSON {String(lesson.order).padStart(2, '0')}{' '}
            <i>/ {lessons.length}</i>
          </span>
          <span className={`difficulty ${lesson.difficulty}`}>
            {difficultyLabel[lesson.difficulty]}
          </span>
          <span className="meta-time">
            <Clock3 size={13} />
            {lesson.estimatedMinutes} 分钟
          </span>
        </div>
        <h1>{lesson.order === 1 ? '谁负责这个值？' : lesson.title}</h1>
        <p className="lesson-objective">{lesson.objective}</p>
      </div>
      {lesson.order === 1 && (
        <div className="first-screen-model">
          <div>
            <small>JAVA / GO</small>
            <p>
              内存生命周期 <span>→</span> <b>GC</b>
            </p>
          </div>
          <div className="model-separator">对比</div>
          <div>
            <small>RUST</small>
            <p>
              value <span>→</span> owner <span>→</span> scope ends{' '}
              <span>→</span> <b className="rust-orange">Drop</b>
            </p>
          </div>
        </div>
      )}
      {lesson.order !== 1 && (
        <>
          <section className="section-block">
            <div className="section-heading">
              <span className="section-icon">
                <BookOpen size={15} />
              </span>
              <div>
                <h2>核心概念</h2>
                <small>先从 Rust 自身语义出发</small>
              </div>
            </div>
            <p className="explanation">{lesson.explanation}</p>
          </section>
          {lesson.mentalModel && (
            <section className="mental-card">
              <div className="mental-title">
                <span>心智模型</span>
                <small>{lesson.mentalModel.description}</small>
              </div>
              <div className="mental-diagrams">
                {lesson.mentalModel.before && (
                  <pre>{lesson.mentalModel.before}</pre>
                )}
                {lesson.mentalModel.after && (
                  <>
                    <span className="diagram-arrow">
                      {lesson.mentalModel.before ? '→' : ''}
                    </span>
                    <pre>{lesson.mentalModel.after}</pre>
                  </>
                )}
              </div>
            </section>
          )}
          <section className="section-block code-section">
            <div className="section-heading">
              <span className="section-icon">
                <Code2 size={15} />
              </span>
              <div>
                <h2>代码示例</h2>
                <small>注意观察资源如何流动</small>
              </div>
            </div>
            {lesson.examples.map((example, index) => (
              <div className="code-card" key={index}>
                <div className="code-toolbar">
                  <span>
                    <i className="language-dot" />
                    {example.language.toUpperCase()}{' '}
                    {example.label && <em>· {example.label}</em>}
                  </span>
                  <button
                    className="copy-button"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(example.code)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1400)
                    }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
                <CodeBlock code={example.code} />
              </div>
            ))}
          </section>
        </>
      )}
      {exercises.length > 0 && (
        <section className="exercise-card" id="exercise">
          <div className="exercise-topline">
            <div>
              <span className="exercise-eyebrow">
                <span className="exercise-dot" />
                互动练习
              </span>
              <h2>
                {activeExercise === 0 && lesson.order === 1
                  ? '这段代码会发生什么？'
                  : exercise.prompt}
              </h2>
            </div>
            <span className="exercise-counter">
              {String(activeExercise + 1).padStart(2, '0')}{' '}
              <i>/ {String(exercises.length).padStart(2, '0')}</i>
            </span>
          </div>
          {exercise.code && <CodeBlock code={exercise.code} compact />}
          {exercise.prompt !== '提交后预测：程序会怎样？' &&
            lesson.order === 1 &&
            activeExercise === 0 && (
              <p className="exercise-prompt">预测下面这段代码的结果。</p>
            )}
          {exercise.type === 'concept_question' ||
          exercise.type === 'architecture_question' ||
          exercise.type === 'code_completion' ||
          exercise.type === 'code_fix' ? (
            <OpenExercise
              key={exercise.id}
              exercise={exercise}
              existing={existing}
              onSubmit={onAttempt}
            />
          ) : (
            <ChoiceExercise
              key={exercise.id}
              exercise={exercise}
              existing={existing}
              onSubmit={onAttempt}
            />
          )}
          {exercise.tags.length > 0 && (
            <div className="tags-row">
              {exercise.tags.map((tag) => (
                <span key={tag} className="tag-pill">
                  {tagLabel(tag)}
                </span>
              ))}
            </div>
          )}
          <div className="exercise-footer">
            <button
              className="secondary-button"
              disabled={activeExercise === 0}
              onClick={() => setActiveExercise((n) => Math.max(0, n - 1))}
            >
              <ArrowLeft size={14} />
              上一题
            </button>
            <span>
              {activeExercise + 1} / {exercises.length}
            </span>
            {activeExercise < exercises.length - 1 ? (
              <button
                className="secondary-button"
                onClick={() =>
                  setActiveExercise((n) =>
                    Math.min(exercises.length - 1, n + 1),
                  )
                }
              >
                下一题 <ArrowRight size={14} />
              </button>
            ) : (
              <button
                className="primary-button compact-button"
                disabled={!allAnswered || done}
                onClick={onComplete}
              >
                {done ? '本课已完成' : '标记本课完成'} <Check size={14} />
              </button>
            )}
          </div>
        </section>
      )}
      {!exercises.length && (
        <section className="locked-lesson">
          <span className="locked-icon">
            <BookOpen size={17} />
          </span>
          <div>
            <b>路线节点预告 · {lesson.title}</b>
            <p>
              {lesson.objective} 前 8
              节提供完整课程与互动练习；后续节点先展示学习方向。
            </p>
          </div>
        </section>
      )}
      {exercises.length > 0 && (
        <div className="lesson-complete-row">
          {done ? (
            <>
              <CheckCircle2 size={15} />
              已完成本课{' '}
              <button className="text-link" onClick={onReview}>
                复习错题 <ArrowRight size={12} />
              </button>
            </>
          ) : (
            <>
              <span className="completion-ring" />
              完成练习后可标记本课完成
            </>
          )}
        </div>
      )}
      {lesson.order === 1 && (
        <>
          <section className="section-block">
            <div className="section-heading">
              <span className="section-icon">
                <BookOpen size={15} />
              </span>
              <div>
                <h2>核心概念</h2>
                <small>先从 Rust 自身语义出发</small>
              </div>
            </div>
            <p className="explanation">{lesson.explanation}</p>
          </section>
          {lesson.mentalModel && (
            <section className="mental-card">
              <div className="mental-title">
                <span>心智模型</span>
                <small>{lesson.mentalModel.description}</small>
              </div>
              <div className="mental-diagrams">
                {lesson.mentalModel.before && (
                  <pre>{lesson.mentalModel.before}</pre>
                )}
                {lesson.mentalModel.after && (
                  <>
                    <span className="diagram-arrow">→</span>
                    <pre>{lesson.mentalModel.after}</pre>
                  </>
                )}
              </div>
            </section>
          )}
          <section className="section-block code-section">
            <div className="section-heading">
              <span className="section-icon">
                <Code2 size={15} />
              </span>
              <div>
                <h2>代码示例</h2>
                <small>注意观察资源如何流动</small>
              </div>
            </div>
            {lesson.examples.map((example, index) => (
              <div className="code-card" key={index}>
                <div className="code-toolbar">
                  <span>
                    <i className="language-dot" />
                    {example.language.toUpperCase()}{' '}
                    {example.label && <em>· {example.label}</em>}
                  </span>
                  <button
                    className="copy-button"
                    onClick={async () => {
                      await navigator.clipboard?.writeText(example.code)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1400)
                    }}
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? '已复制' : '复制'}
                  </button>
                </div>
                <CodeBlock code={example.code} />
              </div>
            ))}
          </section>
        </>
      )}
      <section className="comparison-block">
        <div className="comparison-heading">
          <span className="comparison-symbol">⇄</span>
          <div>
            <h3>Rust vs Java vs Go</h3>
            <p>相似的代码，不同的内存模型</p>
          </div>
        </div>
        <div className="comparison-grid">
          {lesson.order === 1 ? (
            <>
              <CompareCode
                language="RUST"
                code={'let b = a;'}
                detail="String 所有权 move"
                color="orange"
              />
              <CompareCode
                language="JAVA"
                code={'String b = a;'}
                detail="复制引用，GC 管理对象"
                color="blue"
              />
              <CompareCode
                language="GO"
                code={'b := a'}
                detail="复制 string 值，GC 管理内存"
                color="cyan"
              />
            </>
          ) : (
            <div className="comparison-question">
              <span>试着回答</span>
              <b>
                {lesson.comparisonQuestion?.prompt ??
                  '完成本节后，想一想 Rust 的规则和你熟悉的语言有何差异。'}
              </b>
              <p>答题后会显示对照解析，帮助建立准确的语言模型。</p>
            </div>
          )}
        </div>
      </section>
      <section className="summary-block">
        <div className="summary-title">
          <span>✓</span>
          <h3>本课小结</h3>
        </div>
        <ul>
          {lesson.summary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
      <div className="bottom-navigation">
        <button
          className="text-link"
          onClick={() => onNavigate(lessons[Math.max(0, lesson.order - 2)])}
          disabled={lesson.order === 1}
        >
          <ArrowLeft size={14} />
          上一课
        </button>
        <span>{done ? '进度已保存到本地' : '完成练习后标记本课'}</span>
        <button
          className="primary-button"
          disabled={!allAnswered || done}
          onClick={onComplete}
        >
          {done ? '本课已完成' : '标记本课完成'}
          <Check size={15} />
        </button>
      </div>
    </>
  )
}

function CodeBlock({
  code,
  compact = false,
}: {
  code: string
  compact?: boolean
}) {
  return (
    <pre className={`code-pre ${compact ? 'compact-code' : ''}`}>
      <code>
        {code.split('\n').map((line, i) => (
          <span className="code-line" key={i}>
            <i>{String(i + 1).padStart(2, '0')}</i>
            <span>{highlight(line)}</span>
          </span>
        ))}
      </code>
    </pre>
  )
}
function highlight(line: string) {
  if (line.trim().startsWith('//'))
    return <span className="syntax-comment">{line}</span>
  const chunks = line.split(
    /(\b(?:let|fn|struct|trait|impl|mut|pub|async|await|return|if|else|Result|String|self|true|false)\b|"[^"]*")/g,
  )
  return chunks.map((part, i) =>
    part.startsWith('"') ? (
      <span key={i} className="syntax-string">
        {part}
      </span>
    ) : /^(let|fn|struct|trait|impl|mut|pub|async|await|return|if|else)$/.test(
        part,
      ) ? (
      <span key={i} className="syntax-keyword">
        {part}
      </span>
    ) : /^(Result|String|self|true|false)$/.test(part) ? (
      <span key={i} className="syntax-type">
        {part}
      </span>
    ) : (
      part
    ),
  )
}
function ChoiceExercise({
  exercise,
  existing,
  onSubmit,
}: {
  exercise: Exercise
  existing?: Attempt
  onSubmit: (
    exercise: Exercise,
    answer: string | number,
    correct: boolean,
  ) => void
}) {
  const [selected, setSelected] = useState<number | null>(
    typeof existing?.answer === 'number' ? existing.answer : null,
  )
  const [submitted, setSubmitted] = useState(Boolean(existing))
  const correct = selected === exercise.correctAnswer
  return (
    <>
      <div className="choice-list">
        {exercise.options?.map((option, index) => {
          const isRight = submitted && index === exercise.correctAnswer
          const isWrong = submitted && selected === index && !correct
          return (
            <button
              key={option}
              className={`choice-option ${selected === index ? 'selected' : ''} ${isRight ? 'correct' : ''} ${isWrong ? 'incorrect' : ''}`}
              onClick={() => !submitted && setSelected(index)}
              disabled={submitted}
            >
              <span className="choice-key">
                {String.fromCharCode(65 + index)}
              </span>
              <span>{option}</span>
              {isRight && <CheckCircle2 size={16} />}
              {isWrong && <XCircle size={16} />}
            </button>
          )
        })}
      </div>
      {submitted ? (
        <Feedback
          correct={correct}
          exercise={exercise}
          onRetry={() => {
            setSubmitted(false)
            setSelected(null)
          }}
        />
      ) : (
        <button
          className="primary-button submit-button"
          disabled={selected === null}
          onClick={() => {
            if (selected === null) return
            setSubmitted(true)
            onSubmit(exercise, selected, correct)
          }}
        >
          提交答案 <ArrowRight size={14} />
        </button>
      )}
    </>
  )
}
function OpenExercise({
  exercise,
  existing,
  onSubmit,
}: {
  exercise: Exercise
  existing?: Attempt
  onSubmit: (
    exercise: Exercise,
    answer: string | number,
    correct: boolean,
    score?: number,
  ) => void
}) {
  const [answer, setAnswer] = useState(
    typeof existing?.answer === 'string' ? existing.answer : '',
  )
  const [showReference, setShowReference] = useState(Boolean(existing))
  const [score, setScore] = useState<number | null>(existing?.selfScore ?? null)
  const submitted = showReference
  return (
    <div className="open-answer">
      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="写下你的思路，或尝试补全代码…"
        rows={3}
        disabled={submitted}
      />
      {!submitted ? (
        <button
          className="secondary-button reference-button"
          onClick={() => setShowReference(true)}
        >
          查看参考答案 <ChevronDown size={14} />
        </button>
      ) : (
        <div className="reference-answer">
          <span>参考答案</span>
          <p>{exercise.referenceAnswer}</p>
          <small>{exercise.explanation}</small>
          <div className="self-score">
            <b>你觉得自己掌握了吗？</b>
            <div>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={score === n ? 'chosen' : ''}
                  onClick={() => {
                    setScore(n)
                    onSubmit(exercise, answer, n >= 3, n)
                  }}
                >
                  {n}
                </button>
              ))}
            </div>
            <small>
              {score
                ? `已记录：${score}/5`
                : '自我评分 1–5，3 分及以上计为掌握'}
            </small>
          </div>
        </div>
      )}
      {existing && (
        <span className="saved-answer-note">上次得分已保存在本地</span>
      )}
    </div>
  )
}
function Feedback({
  correct,
  exercise,
  onRetry,
}: {
  correct: boolean
  exercise: Exercise
  onRetry: () => void
}) {
  return (
    <div className={`feedback ${correct ? 'feedback-good' : 'feedback-bad'}`}>
      <div className="feedback-title">
        {correct ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
        {correct ? '回答正确' : '再想一想'}
      </div>
      <p>{exercise.explanation}</p>
      <div className="feedback-rule">
        <b>Rust 规则</b>
        <span>{exercise.rule}</span>
      </div>
      {!correct && exercise.temptingWrong && (
        <div className="tempting-note">
          <b>为什么容易选错</b>
          <span>{exercise.temptingWrong}</span>
        </div>
      )}
      {exercise.comparison && (
        <div className="feedback-rule">
          <b>Java / Go 对比</b>
          <span>{exercise.comparison}</span>
        </div>
      )}
      <button className="retry-button" onClick={onRetry}>
        <RotateCcw size={13} />
        重新作答
      </button>
    </div>
  )
}
function CompareCode({
  language,
  code,
  detail,
  color,
}: {
  language: string
  code: string
  detail: string
  color: string
}) {
  return (
    <div className="compare-cell">
      <span className={`compare-lang ${color}`}>{language}</span>
      <code>{code}</code>
      <small>{detail}</small>
    </div>
  )
}

function ReviewView({
  progress,
  lessons: allLessons,
  onAttempt,
  onNavigate,
}: {
  progress: Progress
  lessons: Lesson[]
  onAttempt: (
    lesson: Lesson,
    exercise: Exercise,
    answer: string | number,
    correct: boolean,
    score?: number,
  ) => void
  onNavigate: (lesson: Lesson) => void
}) {
  const weak = Object.entries(progress.weakness)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
  const questionPool = allLessons
    .filter((lesson) => progress.completed.includes(lesson.id))
    .flatMap((lesson) =>
      allExercises(
        lesson.exercises,
        lesson.comparisonQuestion,
        lesson.challenge,
      )
        .filter((ex) =>
          ex.tags.some((tag) => (progress.weakness[tag] ?? 0) > 0),
        )
        .map((exercise) => ({ lesson, exercise })),
    )
  const [cursor, setCursor] = useState(0)
  const entry = questionPool[cursor]
  return (
    <div className="utility-page">
      <div className="breadcrumb">
        <span>学习工具</span>
        <ChevronRight size={13} />
        <span>Review</span>
      </div>
      <div className="utility-title-row">
        <div>
          <span className="utility-eyebrow">REVIEW MODE</span>
          <h1>薄弱点复习</h1>
          <p>从已完成课程中抽取与你的薄弱知识点相关的练习。</p>
        </div>
        <div className="review-count">
          <RotateCcw size={17} />
          <b>{questionPool.length}</b>
          <small>道待复习</small>
        </div>
      </div>
      {weak.length > 0 && (
        <div className="weak-tag-list">
          <h3>当前关注</h3>
          {weak.map(([tag, score]) => (
            <span className="tag-pill" key={tag}>
              {tagLabel(tag)} <b>{score}</b>
            </span>
          ))}
        </div>
      )}
      {entry ? (
        <section className="exercise-card review-exercise">
          <div className="exercise-eyebrow">
            <span className="exercise-dot" />
            来自第 {String(entry.lesson.order).padStart(2, '0')} 课 ·{' '}
            {entry.lesson.title}
          </div>
          <h2>{entry.exercise.prompt}</h2>
          {entry.exercise.code && (
            <CodeBlock code={entry.exercise.code} compact />
          )}
          {entry.exercise.correctAnswer !== undefined ? (
            <ChoiceExercise
              key={`${entry.exercise.id}-${cursor}`}
              exercise={entry.exercise}
              onSubmit={(exercise, answer, correct) =>
                onAttempt(entry.lesson, exercise, answer, correct)
              }
            />
          ) : (
            <OpenExercise
              key={`${entry.exercise.id}-${cursor}`}
              exercise={entry.exercise}
              onSubmit={(exercise, answer, correct, score) =>
                onAttempt(entry.lesson, exercise, answer, correct, score)
              }
            />
          )}
          <div className="exercise-footer">
            <button
              className="secondary-button"
              onClick={() =>
                setCursor(Math.floor(Math.random() * questionPool.length))
              }
            >
              <RotateCcw size={13} />
              随机抽题
            </button>
            <button
              className="text-link"
              onClick={() => onNavigate(entry.lesson)}
            >
              查看原课程 <ArrowRight size={13} />
            </button>
          </div>
        </section>
      ) : (
        <div className="empty-state">
          <span className="empty-check">
            <Check size={16} />
          </span>
          <h2>
            {progress.completed.length
              ? '暂时没有待复习的薄弱题'
              : '完成课程后开始复习'}
          </h2>
          <p>
            {progress.completed.length
              ? '继续学习新内容，答错的知识点会自动出现在这里。'
              : '练习提交后，系统会记录薄弱知识点，并从已完成课程抽取复习题。'}
          </p>
          <button
            className="primary-button"
            onClick={() => onNavigate(lessons[0])}
          >
            开始第 01 课 <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
function ProgressView({
  progress,
  accuracy,
}: {
  progress: Progress
  accuracy: number
}) {
  const categoryStats = [
    'Ownership',
    'Type System',
    'Concurrency',
    'Web',
    'Database',
    'Agent Infra',
  ].map((category) => {
    const lessonsOfCategory = lessons.filter(
      (item) => item.category === category,
    )
    const complete = lessonsOfCategory.filter((item) =>
      progress.completed.includes(item.id),
    ).length
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
          <small>正确率</small>
          <strong>{progress.attempts.length ? `${accuracy}%` : '—'}</strong>
        </div>
      </div>
      <section className="mastery-section">
        <h2>分类掌握程度</h2>
        <p>按路线统计已完成课程</p>
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
        <h2>最近答题</h2>
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
                  <small>{attempt.exerciseId}</small>
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
