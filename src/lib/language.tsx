import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  browserStorageKey,
  readStoredValue,
  writeStoredValue,
} from './browserStorage'

export type Language = 'zh' | 'en'

const LANGUAGE_KEY = browserStorageKey('language')

export function browserLanguage(value: string | undefined): Language {
  return value?.toLowerCase().split(/[-_]/, 1)[0] === 'zh' ? 'zh' : 'en'
}

function initialLanguage(): Language {
  const stored = readStoredValue(LANGUAGE_KEY)
  if (stored.ok && (stored.value === 'zh' || stored.value === 'en'))
    return stored.value
  return browserLanguage(navigator.language)
}

interface LanguageContextValue {
  language: Language
  setLanguage: (language: Language) => void
  t: (chinese: string, english: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setCurrentLanguage] = useState<Language>(initialLanguage)

  function setLanguage(next: Language): void {
    setCurrentLanguage(next)
    writeStoredValue(LANGUAGE_KEY, next)
  }

  useEffect(() => {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en'
    document.title =
      language === 'zh'
        ? 'rust.path · Rust 工程学习'
        : 'rust.path · Learn Rust Engineering'
    const description = document.querySelector<HTMLMetaElement>(
      'meta[name="description"]',
    )
    if (description)
      description.content =
        language === 'zh'
          ? '面向开发者的开源 Rust 工程课程，在浏览器阅读，在本地完成练习。'
          : 'Open source Rust engineering courses. Read in your browser and practice locally.'
  }, [language])

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t: (zh, en) => (language === 'zh' ? zh : en),
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const context = useContext(LanguageContext)
  if (context) return context
  // Standalone page renderers can still use browser language outside the app shell.
  const language = browserLanguage(navigator.language)
  return {
    language,
    setLanguage: () => {},
    t: (zh, en) => (language === 'zh' ? zh : en),
  }
}
