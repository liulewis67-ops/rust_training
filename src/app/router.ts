import { useEffect, useState } from 'react'
import { lessons } from '../features/catalog'

export type Route =
  | { page: 'lesson'; lessonId: string }
  | { page: 'review' | 'progress' }
  | { page: 'not-found'; path: string }

/** 解析现有路径；未知课程或非法编码明确显示未找到，不偷偷跳到首课。 */
export function readRoute(pathname: string, resumeLesson = 'ownership'): Route {
  if (pathname === '/') {
    const known = lessons.some((lesson) => {
      // 历史课程已下线时仅对首页恢复使用首课回退。
      return lesson.id === resumeLesson
    })
    return { page: 'lesson', lessonId: known ? resumeLesson : 'ownership' }
  }
  if (pathname === '/review' || pathname === '/review/')
    return { page: 'review' }
  if (pathname === '/progress' || pathname === '/progress/')
    return { page: 'progress' }
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
  if (route.page === 'lesson')
    return `/lesson/${encodeURIComponent(route.lessonId)}`
  if (route.page === 'not-found') return route.path
  return `/${route.page}`
}

/** 管理 History 订阅；卸载时清理监听，浏览器前进后退与页面一致。 */
export function useRoute(resumeLesson: string): {
  route: Route
  navigate: (target: Route) => void
} {
  const [route, setRoute] = useState<Route>(() => {
    // 首页只在初始化时恢复历史课程，直接链接始终优先。
    return readRoute(window.location.pathname, resumeLesson)
  })
  useEffect(() => {
    // popstate 同时接收浏览器历史变更和内部导航事件。
    /** 根据当前 URL 恢复页面，沿用有效的最近阅读课程。 */
    function handlePopState(): void {
      setRoute(readRoute(window.location.pathname, resumeLesson))
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      // 避免热更新、严格模式和重复挂载累积事件处理器。
      window.removeEventListener('popstate', handlePopState)
    }
  }, [resumeLesson])
  /** 仅在地址变化时增加历史条目，再通知所有路由订阅者。 */
  function navigate(target: Route): void {
    const path = routePath(target)
    if (window.location.pathname !== path)
      window.history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }
  return { route, navigate }
}
