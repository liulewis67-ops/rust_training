import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  LanguageProvider,
  browserLanguage,
  useLanguage,
} from '../../lib/language'

function LanguageFixture() {
  const { language, setLanguage, t } = useLanguage()
  return (
    <div>
      <span>{language}</span>
      <h1>{t('课程目录', 'Course catalog')}</h1>
      <button onClick={() => setLanguage(language === 'zh' ? 'en' : 'zh')}>
        Switch
      </button>
    </div>
  )
}

afterEach(() => {
  cleanup()
  localStorage.clear()
  Object.defineProperty(navigator, 'language', {
    configurable: true,
    value: 'zh-CN',
  })
})

it('uses Chinese for zh browser locales and English for every other locale', () => {
  expect(browserLanguage('zh-CN')).toBe('zh')
  expect(browserLanguage('zh-TW')).toBe('zh')
  expect(browserLanguage('en-US')).toBe('en')
  expect(browserLanguage('fr-FR')).toBe('en')
  expect(browserLanguage(undefined)).toBe('en')
})

it('follows browser language until the learner explicitly switches', async () => {
  const user = userEvent.setup()
  Object.defineProperty(navigator, 'language', {
    configurable: true,
    value: 'fr-FR',
  })
  const first = render(
    <LanguageProvider>
      <LanguageFixture />
    </LanguageProvider>,
  )
  expect(screen.getByRole('heading', { name: 'Course catalog' })).toBeTruthy()
  expect(document.documentElement.lang).toBe('en')
  expect(localStorage.getItem('rust-path:language')).toBeNull()
  first.unmount()

  Object.defineProperty(navigator, 'language', {
    configurable: true,
    value: 'zh-TW',
  })
  render(
    <LanguageProvider>
      <LanguageFixture />
    </LanguageProvider>,
  )
  expect(screen.getByRole('heading', { name: '课程目录' })).toBeTruthy()
  await user.click(screen.getByRole('button', { name: 'Switch' }))
  expect(screen.getByRole('heading', { name: 'Course catalog' })).toBeTruthy()
  expect(localStorage.getItem('rust-path:language')).toBe('en')
})
