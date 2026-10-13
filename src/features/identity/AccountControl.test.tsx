import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AccountControl } from './AccountControl'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// 未登录时进入站内邮箱账号登录页。
it('shows the local login page for an anonymous session', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
  )
  render(<AccountControl />)
  expect(
    (await screen.findByRole('link', { name: '登录' })).getAttribute('href'),
  ).toBe('/login')
})

// 已认证后允许退出，并在服务端确认后清空身份展示。
it('logs out the server session', async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(
        JSON.stringify({ user_id: 'student-1', email: 'student@example.test' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    )
    .mockResolvedValueOnce(new Response(null, { status: 204 }))
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
  vi.stubGlobal('fetch', fetchMock)
  render(<AccountControl />)

  expect(await screen.findByText('student@example.test')).toBeTruthy()
  fireEvent.click(await screen.findByRole('button', { name: '退出' }))
  await waitFor(() =>
    expect(screen.getByRole('link', { name: '登录' })).toBeTruthy(),
  )
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/auth/logout',
    expect.objectContaining({ method: 'POST', credentials: 'same-origin' }),
  )
})
