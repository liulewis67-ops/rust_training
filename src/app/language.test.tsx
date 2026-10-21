import { afterEach, expect, it } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import App from './App'

afterEach(() => {
  cleanup()
  localStorage.clear()
  window.history.replaceState({}, '', '/#/')
  Object.defineProperty(navigator, 'language', {
    configurable: true,
    value: 'zh-CN',
  })
})

it('shows English for an unsupported browser locale and switches the catalog to Chinese', async () => {
  Object.defineProperty(navigator, 'language', {
    configurable: true,
    value: 'fr-FR',
  })
  const user = userEvent.setup()
  render(<App />)

  expect(
    screen.getByRole('heading', {
      name: 'From Rust fundamentals to production ready backend services.',
    }),
  ).toBeTruthy()
  await user.click(
    within(
      screen.getByRole('navigation', { name: 'Main navigation' }),
    ).getByRole('button', { name: 'Courses' }),
  )
  expect(
    screen.getByRole('heading', { name: 'Rust Backend Engineer Path' }),
  ).toBeTruthy()
  expect(
    screen.getAllByText('Development Loop and Language Basics').length,
  ).toBeGreaterThan(0)

  await user.selectOptions(
    screen.getByRole('combobox', { name: 'Language' }),
    'zh',
  )
  expect(
    screen.getByRole('heading', { name: 'Rust 后端工程师路线' }),
  ).toBeTruthy()
  expect(screen.getAllByText('开发循环与语言入门').length).toBeGreaterThan(0)
  expect(localStorage.getItem('rust-path:language')).toBe('zh')
})
