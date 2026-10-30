import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { CourseLessonPage } from './CourseLessonPage'

afterEach(() => cleanup())

it('scrolls to a published lesson section after content renders', async () => {
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollIntoView',
  )
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const scrollIntoView = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  })

  try {
    const props = {
      moduleId: 'M01',
      lessonId: 'L01',
      completed: false,
      onComplete: vi.fn(),
      onNavigate: vi.fn(),
    }
    const view = render(<CourseLessonPage {...props} />)

    await screen.findByRole('heading', {
      name: 'Rust 解决的问题与路线选择',
    })
    view.rerender(<CourseLessonPage {...props} sectionId="学习目标" />)

    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'auto',
        block: 'start',
      }),
    )
    expect(document.getElementById('学习目标')).not.toBeNull()
  } finally {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original)
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
    }
  }
})

it('opens collapsed supplementary evidence for a deep-linked section', async () => {
  const original = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'scrollIntoView',
  )
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  const scrollIntoView = vi.fn()
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: scrollIntoView,
  })
  try {
    const props = {
      moduleId: 'M07',
      lessonId: 'L05',
      completed: false,
      onComplete: vi.fn(),
      onNavigate: vi.fn(),
    }
    const view = render(<CourseLessonPage {...props} />)
    await waitFor(() => {
      expect(document.getElementById('参考实现')).not.toBeNull()
    })
    const reference = document.getElementById('参考实现')
    expect(reference?.tagName).toBe('SUMMARY')
    const item = reference?.closest('details')
    const master = item?.parentElement?.closest('details')
    expect(item?.open).toBe(false)
    expect(master?.open).toBe(false)

    view.rerender(<CourseLessonPage {...props} sectionId="参考实现" />)
    await waitFor(() => {
      expect(item?.open).toBe(true)
      expect(master?.open).toBe(true)
    })
    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: 'auto',
      block: 'start',
    })
  } finally {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original)
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
    }
    vi.restoreAllMocks()
  }
})

it('keeps supplementary answers behind accessible disclosure controls', async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  render(
    <CourseLessonPage
      moduleId="M08"
      lessonId="L05"
      completed={false}
      onComplete={vi.fn()}
      onNavigate={vi.fn()}
    />,
  )
  await waitFor(() => {
    expect(document.getElementById('lesson-support')).not.toBeNull()
  })
  const heading = document.getElementById('lesson-support')
  expect(heading?.tagName).toBe('SUMMARY')
  const disclosure = heading?.closest('details')
  expect(disclosure?.open).toBe(false)
  expect(document.getElementById('参考实现')).not.toBeNull()
})
