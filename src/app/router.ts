import { useEffect, useState } from 'react'
import { lessons } from '../features/catalog'
import { findCourseLesson } from '../data/courseCatalog'
import type { AuthMode } from '../features/identity/AuthPage'

export type Route =
  | { page: 'home' }
  | { page: 'search' }
  | { page: 'lesson'; lessonId: string }
  | { page: 'course-lesson'; moduleId: string; lessonId: string }
  | { page: 'track'; trackSlug: string }
  | { page: 'course-preview'; courseId: string }
  | { page: 'review' | 'progress' }
  | { page: 'auth'; mode: AuthMode }
  | { page: 'not-found'; path: string }

/** 解析现有路径；未知课程或非法编码明确显示未找到，不偷偷跳到首课。 */
export function readRoute(pathname: string): Route {
  const authRoutes: Record<string, AuthMode> = {
    '/login': 'login',
    '/register': 'register',
    '/verify-email': 'verify',
    '/forgot-password': 'forgot',
    '/reset-password': 'reset',
  }
  if (authRoutes[pathname]) return { page: 'auth', mode: authRoutes[pathname] }
  if (pathname === '/') return { page: 'home' }
  if (pathname === '/search' || pathname === '/search/')
    return { page: 'search' }
  if (pathname === '/review' || pathname === '/review/')
    return { page: 'review' }
  if (pathname === '/progress' || pathname === '/progress/')
    return { page: 'progress' }
  if (
    pathname === '/tracks/rust-backend' ||
    pathname === '/tracks/rust-backend/'
  )
    return { page: 'track', trackSlug: 'rust-backend' }
  const courseLessonMatch = /^\/courses\/(m\d{2})\/(l\d{2})\/?$/i.exec(pathname)
  if (
    courseLessonMatch &&
    findCourseLesson(courseLessonMatch[1], courseLessonMatch[2])
  ) {
    return {
      page: 'course-lesson',
      moduleId: courseLessonMatch[1].toUpperCase(),
      lessonId: courseLessonMatch[2].toUpperCase(),
    }
  }
  const previewMatch = /^\/preview\/([a-z0-9-]+)\/?$/.exec(pathname)
  if (previewMatch) return { page: 'course-preview', courseId: previewMatch[1] }
  const match = /^\/lesson\/([^/]+)\/?$/.exec(pathname)
  try {
    const id = match ? decodeURIComponent(match[1]) : ''
    if (
      lessons.some((lesson) => {
        // 保留原型全部旧 ID，新课程映射留给正式课程导航任务。
        return lesson.id === id
      })
    )
      return { page: 'lesson', lessonId: id }
  } catch {
    // 百分号编码损坏也属于未知地址，避免路由解析抛错导致白屏。
  }
  return { page: 'not-found', path: pathname }
}

/** 将路由意图映射为原型兼容 URL。 */
function routePath(route: Route): string {
  if (route.page === 'auth')
    return `/${route.mode === 'forgot' ? 'forgot-password' : route.mode === 'verify' ? 'verify-email' : route.mode === 'reset' ? 'reset-password' : route.mode}`
  if (route.page === 'home') return '/'
  if (route.page === 'search') return '/search'
  if (route.page === 'track')
    return `/tracks/${encodeURIComponent(route.trackSlug)}`
  if (route.page === 'lesson')
    return `/lesson/${encodeURIComponent(route.lessonId ?? '')}`
  if (route.page === 'course-lesson')
    return `/courses/${route.moduleId.toLowerCase()}/${route.lessonId.toLowerCase()}`
  if (route.page === 'course-preview')
    return `/preview/${encodeURIComponent(route.courseId)}`
  if (route.page === 'not-found') return route.path
  return `/${route.page}`
}

/** 管理 History 订阅；卸载时清理监听，浏览器前进后退与页面一致。 */
export function useRoute(): {
  route: Route
  navigate: (target: Route) => void
} {
  const [route, setRoute] = useState<Route>(() => {
    // 直接打开首页显示路线入口，旧课程仅通过原链接访问。
    return readRoute(window.location.pathname)
  })
  useEffect(() => {
    // popstate 同时接收浏览器历史变更和内部导航事件。
    /** 根据当前 URL 恢复页面，沿用有效的最近阅读课程。 */
    function handlePopState(): void {
      setRoute(readRoute(window.location.pathname))
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      // 避免热更新、严格模式和重复挂载累积事件处理器。
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])
  /** 仅在地址变化时增加历史条目，再通知所有路由订阅者。 */
  function navigate(target: Route): void {
    const path = routePath(target)
    if (window.location.pathname !== path)
      window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  return { route, navigate }
}
