import { useEffect, useState } from 'react'
import {
  browserStorageKey,
  readStoredValue,
  writeStoredValue,
} from '../../lib/browserStorage'

export type Theme = 'dark' | 'light'
const THEME_KEY = browserStorageKey('theme')

/** 保留原型深浅偏好；存储被禁用时仍可在当前会话使用主题。 */
function readTheme(): Theme {
  const result = readStoredValue(THEME_KEY)
  return result.ok && result.value === 'light' ? 'light' : 'dark'
}

/** 将主题同步到根节点，偏好持久化失败不妨碍阅读。 */
export function useTheme(): { theme: Theme; toggleTheme: () => void } {
  const [theme, setTheme] = useState<Theme>(readTheme)
  useEffect(() => {
    // CSS 主题与轻量偏好共享一个状态源。
    document.documentElement.dataset.theme = theme
    writeStoredValue(THEME_KEY, theme)
  }, [theme])
  /** 切换当前会话的深浅主题。 */
  function toggleTheme(): void {
    setTheme((current) => {
      // 基于最新值切换，支持快速连续点击。
      return current === 'dark' ? 'light' : 'dark'
    })
  }
  return { theme, toggleTheme }
}
