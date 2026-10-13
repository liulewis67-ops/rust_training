export type AuthSession = { user_id: string; email: string }

export type AuthError = {
  code: string
  message: string
  request_id?: string
  retryable?: boolean
}

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'AuthApiError'
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new AuthApiError('无法连接账号服务，请稍后重试。', 'network_error', 0)
  }

  if (response.status === 204) return undefined as T
  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new AuthApiError(
      '账号服务暂不可用，请稍后重试。',
      'invalid_response',
      response.status,
    )
  }
  if (!response.ok) {
    const error = payload as Partial<AuthError>
    throw new AuthApiError(
      typeof error.message === 'string'
        ? error.message
        : '请求失败，请稍后重试。',
      typeof error.code === 'string' ? error.code : 'request_failed',
      response.status,
    )
  }
  return payload as T
}

export async function login(
  email: string,
  password: string,
): Promise<AuthSession> {
  const session = await request<AuthSession>('/api/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  sessionChanged()
  return session
}

export function register(
  email: string,
  password: string,
): Promise<{ message: string }> {
  return request('/api/v1/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function verifyEmail(token: string): Promise<void> {
  return request('/api/v1/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  })
}

export function resendVerification(
  email: string,
): Promise<{ message: string }> {
  return request('/api/v1/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function forgotPassword(email: string): Promise<{ message: string }> {
  return request('/api/v1/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
}

export function resetPassword(
  token: string,
  newPassword: string,
): Promise<void> {
  return request('/api/v1/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword }),
  })
}

export function readSession(): Promise<AuthSession> {
  return request('/api/v1/auth/session', { method: 'GET' })
}

export async function logout(): Promise<void> {
  await request<void>('/api/v1/auth/logout', { method: 'POST' })
  sessionChanged()
}

function sessionChanged(): void {
  window.dispatchEvent(new Event('rust-path-session-changed'))
}
