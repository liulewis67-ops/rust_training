import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SafeMarkdown } from './SafeMarkdown'

// Only a small Markdown subset is rendered; active HTML and unsafe links stay inert.
it('filters active HTML and unsafe URL schemes while rendering safe Markdown', () => {
  const { container } = render(
    <SafeMarkdown
      content={
        '安全正文 <script>alert(1)</script><img src=x onerror=alert(2)> **借用切片** [危险链接](javascript:alert(3)) [Rust Book](https://doc.rust-lang.org/book/)'
      }
    />,
  )

  expect(container.querySelector('script, img')).toBeNull()
  expect(container.textContent).not.toContain('alert')
  expect(screen.getByText('借用切片').tagName).toBe('STRONG')
  expect(screen.queryByRole('link', { name: '危险链接' })).toBeNull()
  expect(
    screen.getByRole('link', { name: 'Rust Book' }).getAttribute('href'),
  ).toBe('https://doc.rust-lang.org/book/')
})
