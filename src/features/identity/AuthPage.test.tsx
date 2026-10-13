import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { AuthPage } from './AuthPage'

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.history.replaceState({}, '', '/')
})

// 登录请求携带邮箱和密码，并将服务端认证状态交回应用。
it('submits local credentials and returns to the application after login', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({ user_id: 'account-1', email: 'learner@example.test' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  const onAuthenticated = vi.fn()
  render(
    <AuthPage
      mode="login"
      onAuthenticated={onAuthenticated}
      onResetComplete={vi.fn()}
    />,
  )

  fireEvent.change(screen.getByLabelText('邮箱'), {
    target: { value: 'learner@example.test' },
  })
  fireEvent.change(screen.getByLabelText('密码'), {
    target: { value: 'correct horse battery' },
  })
  fireEvent.click(screen.getByRole('button', { name: '登录' }))

  await waitFor(() => expect(onAuthenticated).toHaveBeenCalledOnce())
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/auth/login',
    expect.objectContaining({
      method: 'POST',
      credentials: 'same-origin',
      body: JSON.stringify({
        email: 'learner@example.test',
        password: 'correct horse battery',
      }),
    }),
  )
})

// 空字段不能发请求；服务端失败消息能显示在表单上。
it('blocks blank login fields and displays server errors', async () => {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        code: 'invalid_credentials',
        message: '邮箱或密码不正确。',
        request_id: 'request-1',
        retryable: false,
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    ),
  )
  vi.stubGlobal('fetch', fetchMock)
  render(
    <AuthPage
      mode="login"
      onAuthenticated={vi.fn()}
      onResetComplete={vi.fn()}
    />,
  )

  fireEvent.click(screen.getByRole('button', { name: '登录' }))
  expect(await screen.findByText('请输入邮箱地址。')).toBeTruthy()
  expect(fetchMock).not.toHaveBeenCalled()

  fireEvent.change(screen.getByLabelText('邮箱'), {
    target: { value: 'learner@example.test' },
  })
  fireEvent.change(screen.getByLabelText('密码'), {
    target: { value: 'wrong password' },
  })
  fireEvent.click(screen.getByRole('button', { name: '登录' }))
  expect(await screen.findByText('邮箱或密码不正确。')).toBeTruthy()
})

// 注册成功只显示通用收件箱提示，不建立已登录状态。
it('registers without automatically logging the account in', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: '如果该邮箱需要操作，请检查收件箱。' }),
          { status: 202, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
  )
  const onAuthenticated = vi.fn()
  render(
    <AuthPage
      mode="register"
      onAuthenticated={onAuthenticated}
      onResetComplete={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText('邮箱'), {
    target: { value: 'learner@example.test' },
  })
  fireEvent.change(screen.getByLabelText(/新密码/), {
    target: { value: 'a long secure passphrase' },
  })
  fireEvent.click(
    screen.getByRole('button', { name: '创建账号并发送验证邮件' }),
  )

  expect((await screen.findByRole('status')).textContent).toContain(
    '如果该邮箱需要操作，请检查收件箱。',
  )
  expect(onAuthenticated).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: '登录' }).getAttribute('href')).toBe(
    '/login',
  )
})

// 忘记密码页面保持统一的防枚举提示。
it('shows the generic reset-email response', async () => {
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ message: '如果该邮箱已注册并验证，请检查收件箱。' }),
          { status: 202, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
  )
  render(
    <AuthPage
      mode="forgot"
      onAuthenticated={vi.fn()}
      onResetComplete={vi.fn()}
    />,
  )
  fireEvent.change(screen.getByLabelText('邮箱'), {
    target: { value: 'unknown@example.test' },
  })
  fireEvent.click(screen.getByRole('button', { name: '发送密码重置邮件' }))
  expect((await screen.findByRole('status')).textContent).toContain(
    '如果该邮箱已注册并验证，请检查收件箱。',
  )
})

// 验证页面只通过 POST 消耗 URL 中的一次性令牌。
it('posts the verification token and removes it from the address after success', async () => {
  window.history.replaceState({}, '', '/verify-email?token=one-time-token')
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
  render(
    <AuthPage
      mode="verify"
      onAuthenticated={vi.fn()}
      onResetComplete={vi.fn()}
    />,
  )

  await waitFor(() =>
    expect(screen.getByRole('status').textContent).toContain('邮箱验证成功'),
  )
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/auth/verify-email',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ token: 'one-time-token' }),
    }),
  )
  expect(window.location.search).toBe('')
})

// 密码重置通过 POST 提交令牌，成功后回到登录页面。
it('posts a reset token and navigates to login after success', async () => {
  window.history.replaceState({}, '', '/reset-password?token=reset-token')
  const fetchMock = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 204 }))
  vi.stubGlobal('fetch', fetchMock)
  const onResetComplete = vi.fn()
  render(
    <AuthPage
      mode="reset"
      onAuthenticated={vi.fn()}
      onResetComplete={onResetComplete}
    />,
  )
  fireEvent.change(document.querySelector('input[name="new-password"]')!, {
    target: { value: 'another secure passphrase' },
  })
  fireEvent.click(screen.getByRole('button', { name: '保存新密码' }))

  await waitFor(() => expect(onResetComplete).toHaveBeenCalledOnce())
  expect(fetchMock).toHaveBeenCalledWith(
    '/api/v1/auth/reset-password',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        token: 'reset-token',
        new_password: 'another secure passphrase',
      }),
    }),
  )
  expect(window.location.search).toBe('')
})
