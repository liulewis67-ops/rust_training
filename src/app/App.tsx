import { useEffect, type JSX } from 'react'
import { lessons, allExercises } from '../features/catalog'
import { summarizeProgress, useProgress } from '../features/learning'
import { useTheme } from '../features/preferences'
import { LessonPage } from '../pages/LessonPage'
import { ReviewPage } from '../pages/ReviewPage'
import { ProgressPage } from '../pages/ProgressPage'
import { CoursePreviewPage } from '../pages/CoursePreviewPage'
import { HomePage } from '../pages/HomePage'
import { TrackPage } from '../pages/TrackPage'
import { SearchPage } from '../pages/SearchPage'
import { AuthPage } from '../features/identity/AuthPage'
import { CourseLessonPage } from '../pages/CourseLessonPage'
import type { Exercise, Lesson } from '../types/lesson'
import { AppShell } from './AppShell'
import { useRoute } from './router'

/** 连接应用路由、页面和功能 Hook，不在入口实现存储协议或答题规则。 */
export default function App(): JSX.Element {
  const {
    progress,
    saveStatus,
    rememberLesson,
    completeLesson,
    saveReflection,
    setTimeZone,
    retrySync,
    legacyPreview,
    importLegacy,
    syncStatus,
    submitAttempt,
  } = useProgress()
  const { route, navigate } = useRoute()
  const { theme, toggleTheme } = useTheme()
  const lessonId = route.page === 'lesson' ? route.lessonId : undefined
  const current =
    lessons.find((lesson) => {
      // 路由已经验证课程 ID，布局在工具页使用首课作为非选中占位。
      return lesson.id === lessonId
    }) ?? lessons[0]
  useEffect(() => {
    // 直接链接和历史导航也保存最后阅读位置；未知路由不改写旧记录。
    if (lessonId) rememberLesson(lessonId)
  }, [lessonId, rememberLesson])

  /** 将课程选择交给路由层处理。 */
  function selectLesson(lesson: Lesson): void {
    navigate({ page: 'lesson', lessonId: lesson.id })
  }
  /** 绑定阅读页课程上下文，复用学习模块的提交规则。 */
  function saveAttempt(
    exercise: Exercise,
    answer: string | number,
    correct: boolean,
    score?: number,
  ): void {
    submitAttempt(current.id, exercise, answer, correct, score)
  }
  /** 绑定复习题来源，避免记录到当前阅读课程。 */
  function saveReviewAttempt(
    lesson: Lesson,
    exercise: Exercise,
    answer: string | number,
    correct: boolean,
    score?: number,
  ): void {
    submitAttempt(lesson.id, exercise, answer, correct, score)
  }
  /** 记录当前课程的自报完成状态。 */
  function finishLesson(): void {
    completeLesson(current.id)
  }
  /** 保存当前课程的学习反思。 */
  function saveLessonReflection(content: string): void {
    saveReflection(current.id, content)
  }
  /** 打开薄弱点复习。 */
  function openReview(): void {
    navigate({ page: 'review' })
  }
  /** Use the full catalog as the recovery point for an unknown route. */
  function openCourseCatalog(): void {
    navigate({ page: 'track', trackSlug: 'rust-backend' })
  }

  let page: JSX.Element
  if (route.page === 'auth') {
    page = (
      <AuthPage
        mode={route.mode}
        onAuthenticated={() => navigate({ page: 'home' })}
        onResetComplete={() => navigate({ page: 'auth', mode: 'login' })}
      />
    )
  } else if (route.page === 'home') {
    page = <HomePage onNavigate={navigate} progress={progress} />
  } else if (route.page === 'track') {
    page = <TrackPage onNavigate={navigate} />
  } else if (route.page === 'search') {
    page = <SearchPage onNavigate={navigate} />
  } else if (route.page === 'lesson') {
    page = (
      <LessonPage
        key={current.id}
        lesson={current}
        progress={progress}
        exercises={allExercises(
          current.exercises,
          current.comparisonQuestion,
          current.challenge,
        )}
        onAttempt={saveAttempt}
        onComplete={finishLesson}
        reflection={progress.reflections[current.id]?.content ?? ''}
        onReflectionSave={saveLessonReflection}
        onNavigate={selectLesson}
        onReview={openReview}
      />
    )
  } else if (route.page === 'course-lesson') {
    page = (
      <CourseLessonPage
        key={`${route.moduleId}-${route.lessonId}`}
        moduleId={route.moduleId}
        lessonId={route.lessonId}
        onNavigate={navigate}
      />
    )
  } else if (route.page === 'review') {
    page = (
      <ReviewPage
        progress={progress}
        lessons={lessons}
        onAttempt={saveReviewAttempt}
        onNavigate={selectLesson}
      />
    )
  } else if (route.page === 'progress') {
    page = (
      <ProgressPage
        progress={progress}
        accuracy={summarizeProgress(progress).accuracy}
        onTimeZoneSave={setTimeZone}
        canRetrySync={syncStatus === 'error'}
        onRetrySync={retrySync}
        legacyPreview={legacyPreview}
        onLegacyImport={importLegacy}
      />
    )
  } else if (route.page === 'course-preview') {
    page =
      route.courseId === 'borrowed-text' ? (
        <CoursePreviewPage />
      ) : (
        <section className="utility-page">
          <h1>未找到课程或页面</h1>
          <p>该链接不存在，课程可能尚未发布。</p>
          <button className="primary-button" onClick={openCourseCatalog}>
            返回课程目录
          </button>
        </section>
      )
  } else {
    page = (
      <section className="utility-page">
        <h1>未找到课程或页面</h1>
        <p>该链接不存在，课程可能尚未发布。</p>
        <button className="primary-button" onClick={openCourseCatalog}>
          返回课程目录
        </button>
      </section>
    )
  }
  return (
    <AppShell
      progress={progress}
      route={route}
      current={current}
      theme={theme}
      onToggleTheme={toggleTheme}
      onNavigate={navigate}
      saveStatus={saveStatus}
    >
      {page}
    </AppShell>
  )
}
