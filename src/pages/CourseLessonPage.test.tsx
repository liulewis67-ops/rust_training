import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { CourseLessonPage } from './CourseLessonPage'

afterEach(() => cleanup())

it('scrolls to the requested section after the lesson and practice render', async () => {
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
      moduleId: 'M20',
      lessonId: 'L01',
      completed: false,
      onComplete: vi.fn(),
      onNavigate: vi.fn(),
    }
    const view = render(<CourseLessonPage {...props} />)

    await screen.findByRole('heading', { name: '幂等键和重复请求' })
    view.rerender(
      <CourseLessonPage {...props} sectionId="练习一预测请求轨迹" />,
    )

    await waitFor(() =>
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'auto',
        block: 'start',
      }),
    )
    expect(document.getElementById('练习一预测请求轨迹')).not.toBeNull()
  } finally {
    if (original) {
      Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', original)
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scrollIntoView')
    }
  }
})
