import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CodeExamples } from './CodeExamples'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

it('copies a lesson example for local practice', async () => {
  const user = userEvent.setup()
  const write = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockResolvedValue(undefined)
  render(
    <CodeExamples examples={[{ language: 'rust', code: 'let value = 1;' }]} />,
  )

  await user.click(screen.getByRole('button', { name: '复制代码' }))

  expect(write).toHaveBeenCalledWith('let value = 1;')
  expect(screen.getByRole('status').textContent).toContain('已复制')
  expect(screen.queryByRole('textbox')).toBeNull()
})
