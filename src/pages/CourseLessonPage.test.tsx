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
