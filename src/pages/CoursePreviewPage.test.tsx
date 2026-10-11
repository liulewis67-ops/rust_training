import { expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CoursePreviewPage } from './CoursePreviewPage'

// Preview content comes from the public package whitelist and remains visibly unpublished.
it('previews prose, public samples, source links and hints without private answers', () => {
  render(<CoursePreviewPage />)

  expect(
    screen.getByRole('heading', { name: '借用文本并安全返回切片' }),
  ).toBeTruthy()
  expect(
    screen.getByText('先找到空白字符边界，再返回原字符串的切片。'),
  ).toBeTruthy()
  expect(
    screen
      .getByRole('link', { name: 'The Rust Project Developers' })
      .getAttribute('href'),
  ).toBe('https://doc.rust-lang.org/book/ch04-03-slices.html')
  expect(screen.getByText('完整可运行示例')).toBeTruthy()
  expect(screen.getByText('教学片段（不可运行）')).toBeTruthy()
  expect(screen.getByText('预期编译失败 · E0502')).toBeTruthy()
  expect(screen.queryByRole('button', { name: /运行/ })).toBeNull()
  expect(
    screen.queryByText(/private_tests|unicode-boundary|reference_answer/),
  ).toBeNull()
})
