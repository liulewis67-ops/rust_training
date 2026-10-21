import { useEffect, useState } from 'react'
import { lessons } from '../features/catalog'
import { findCourseLesson } from '../data/courseCatalog'
import { findPublicCourseLesson } from '../data/publicCourse'
export type Route =
  | { page: 'home' }
  | { page: 'search' }
  | { page: 'lesson'; lessonId: string }
  | {
      page: 'course-lesson'
      moduleId: string
      lessonId: string
      sectionId?: string
    }
  | { page: 'public-course-lesson'; lessonId: string }
  | { page: 'track'; trackSlug: string }
  | { page: 'review' | 'progress' }
  | { page: 'not-found'; path: string }

/** 解析现有路径；未知课程或非法编码明确显示未找到，不偷偷跳到首课。 */
export function readRoute(pathname: string): Route {
  const queryIndex = pathname.indexOf('?')
  const routePath = queryIndex < 0 ? pathname : pathname.slice(0, queryIndex)
  const query = queryIndex < 0 ? '' : pathname.slice(queryIndex + 1)
  const sectionId = new URLSearchParams(query).get('section') || undefined

  if (routePath === '/') return { page: 'home' }
  if (routePath === '/search' || routePath === '/search/')
    return { page: 'search' }
  if (routePath === '/review' || routePath === '/review/')
    return { page: 'review' }
  if (routePath === '/progress' || routePath === '/progress/')
    return { page: 'progress' }
  if (
    routePath === '/tracks/rust-backend' ||
    routePath === '/tracks/rust-backend/'
  )
    return { page: 'track', trackSlug: 'rust-backend' }
  const courseLessonMatch = /^\/courses\/(m\d{2})\/(l\d{2})\/?$/i.exec(
    routePath,
  )
  if (
    courseLessonMatch &&
    findCourseLesson(courseLessonMatch[1], courseLessonMatch[2])?.published
  ) {
    return {
      page: 'course-lesson',
      moduleId: courseLessonMatch[1].toUpperCase(),
      lessonId: courseLessonMatch[2].toUpperCase(),
      ...(sectionId ? { sectionId } : {}),
    }
  }
  const publicLessonMatch = /^\/public-lessons\/([^/]+)\/?$/i.exec(routePath)
  try {
    const id = publicLessonMatch ? decodeURIComponent(publicLessonMatch[1]) : ''
    if (id && findPublicCourseLesson(id))
      return { page: 'public-course-lesson', lessonId: id }
  } catch {
    // Invalid percent encoding is an unknown path, not a router failure.
  }
  const match = /^\/lesson\/([^/]+)\/?$/.exec(routePath)
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

/** Map a route to the stable hash path used by static hosting. */
function routePath(route: Route): string {
  if (route.page === 'home') return '/'
  if (route.page === 'search') return '/search'
  if (route.page === 'track')
    return `/tracks/${encodeURIComponent(route.trackSlug)}`
  if (route.page === 'lesson')
    return `/lesson/${encodeURIComponent(route.lessonId ?? '')}`
  if (route.page === 'course-lesson') {
    const path = `/courses/${route.moduleId.toLowerCase()}/${route.lessonId.toLowerCase()}`
    return route.sectionId
      ? `${path}?section=${encodeURIComponent(route.sectionId)}`
      : path
  }
  if (route.page === 'public-course-lesson')
    return `/public-lessons/${encodeURIComponent(route.lessonId)}`
  if (route.page === 'not-found') return route.path
  return `/${route.page}`
}

/** 管理 Hash 路由订阅；浏览器前进后退与页面保持一致。 */
export function useRoute(): {
  route: Route
  navigate: (target: Route) => void
} {
  const [route, setRoute] = useState<Route>(() =>
    readRoute(window.location.hash.slice(1) || '/'),
  )
  useEffect(() => {
    // Hash changes support direct links and browser back/forward on GitHub Pages.
    function handleHashChange(): void {
      setRoute(readRoute(window.location.hash.slice(1) || '/'))
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => {
      // Avoid duplicate global listeners after unmount or hot reload.
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])
  /** 仅在地址变化时增加历史条目，再通知所有路由订阅者。 */
  function navigate(target: Route): void {
    const path = `#${routePath(target)}`
    if (window.location.hash !== path) window.location.hash = path
  }
  return { route, navigate }
}
