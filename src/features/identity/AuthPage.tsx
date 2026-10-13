import type { FormEvent, JSX } from 'react'
import { useEffect, useState } from 'react'
import {
  AuthApiError,
  forgotPassword,
  login,
  register,
  resendVerification,
  resetPassword,
  verifyEmail,
} from './api'
import './AuthPage.css'

export type AuthMode = 'login' | 'register' | 'verify' | 'forgot' | 'reset'

type Props = {
  mode: AuthMode
  onAuthenticated: () => void
  onResetComplete: () => void
}

const titles: Record<AuthMode, string> = {
  login: '登录 Rust Path',
  register: '创建账号',
  verify: '验证邮箱',
  forgot: '找回密码',
  reset: '设置新密码',
}

export function AuthPage({
  mode,
  onAuthenticated,
  onResetComplete,
}: Props): JSX.Element {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)

  useEffect(() => {
    if (mode !== 'verify' && mode !== 'reset') return
    const token = new URLSearchParams(window.location.search).get('token') ?? ''
    if (!token) {
      if (mode === 'reset') setError('重置链接缺少令牌。')
      return
    }
    let active = true
    setBusy(true)
    const action = mode === 'verify' ? verifyEmail(token) : Promise.resolve()
    if (mode === 'verify') {
      void action
        .then(() => {
          if (!active) return
          window.history.replaceState({}, '', window.location.pathname)
          setMessage('邮箱验证成功，现在可以登录。')
        })
        .catch((reason: unknown) => {
          if (active) setError(errorMessage(reason))
        })
        .finally(() => active && setBusy(false))
    } else {
      setBusy(false)
    }
    return () => {
      active = false
    }
  }, [mode])

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    setError('')
    setMessage('')
    setNeedsVerification(false)
    if (mode !== 'reset' && !email.trim()) {
      setError('请输入邮箱地址。')
      return
    }
    if (
      (mode === 'login' || mode === 'register' || mode === 'reset') &&
      !password
    ) {
      setError('请输入密码。')
      return
    }
    if ((mode === 'register' || mode === 'reset') && !validPassword(password)) {
      setError('密码需为 12 至 128 个字符。')
      return
    }
    setBusy(true)
    try {
      if (mode === 'login') {
        await login(email, password)
        setPassword('')
        onAuthenticated()
      } else if (mode === 'register') {
        const result = await register(email, password)
        setPassword('')
        setMessage(result.message || '如果该邮箱需要操作，请检查收件箱。')
      } else if (mode === 'forgot') {
        const result = await forgotPassword(email)
        setMessage(result.message || '如果该邮箱已注册并验证，请检查收件箱。')
      } else if (mode === 'reset') {
        const token =
          new URLSearchParams(window.location.search).get('token') ?? ''
        await resetPassword(token, password)
        setPassword('')
        window.history.replaceState({}, '', window.location.pathname)
        onResetComplete()
      } else if (mode === 'verify') {
        const result = await resendVerification(email)
        setMessage(result.message || '如果该邮箱需要操作，请检查收件箱。')
      }
    } catch (reason) {
      setError(errorMessage(reason))
      setNeedsVerification(
        reason instanceof AuthApiError &&
          reason.code === 'email_verification_required',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="auth-page" aria-labelledby="auth-title">
      <div className="auth-card">
        <p className="auth-eyebrow">RUST PATH · ACCOUNT</p>
        <h1 id="auth-title">{titles[mode]}</h1>
        <p className="auth-intro">{intro(mode)}</p>
        {mode === 'verify' &&
        new URLSearchParams(window.location.search).has('token') ? null : (
          <form onSubmit={(event) => void submit(event)} noValidate>
            {mode !== 'reset' && mode !== 'verify' && (
              <label className="auth-field">
                <span>邮箱</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'auth-error' : undefined}
                />
              </label>
            )}
            {mode === 'verify' && (
              <label className="auth-field">
                <span>邮箱</span>
                <input
                  type="email"
                  name="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
            )}
            {(mode === 'login' || mode === 'register' || mode === 'reset') && (
              <label className="auth-field">
                <span>{mode === 'login' ? '密码' : '新密码'}</span>
                <input
                  type="password"
                  name={mode === 'login' ? 'password' : 'new-password'}
                  autoComplete={
                    mode === 'login' ? 'current-password' : 'new-password'
                  }
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  minLength={12}
                  maxLength={512}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? 'auth-error' : 'password-hint'}
                />
                {mode !== 'login' && (
                  <small id="password-hint">12 至 128 个字符</small>
                )}
              </label>
            )}
            {error && (
              <p id="auth-error" className="auth-error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="auth-message" role="status">
                {message}
              </p>
            )}
            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? '请稍候…' : submitLabel(mode)}
            </button>
            {needsVerification && (
              <a className="auth-inline-link" href="/verify-email">
                重发验证邮件
              </a>
            )}
          </form>
        )}
        {mode === 'verify' &&
          new URLSearchParams(window.location.search).has('token') && (
            <>
              {busy && <p role="status">正在验证邮箱…</p>}
              {error && (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              )}
              {error && (
                <a className="auth-inline-link" href="/verify-email">
                  重新发送验证邮件
                </a>
              )}
              {message && (
                <p className="auth-message" role="status">
                  {message}
                </p>
              )}
            </>
          )}
        <nav className="auth-links" aria-label="账号页面">
          {mode !== 'login' && <a href="/login">登录</a>}
          {mode !== 'register' && <a href="/register">创建账号</a>}
          {mode !== 'forgot' && mode === 'login' && (
            <a href="/forgot-password">忘记密码？</a>
          )}
          {mode === 'reset' && <a href="/forgot-password">重新申请密码重置</a>}
          {mode !== 'verify' && mode !== 'reset' && (
            <a href="/verify-email">验证或重发邮箱</a>
          )}
        </nav>
      </div>
    </section>
  )
}

function validPassword(value: string): boolean {
  const count = Array.from(value).length
  return (
    count >= 12 && count <= 128 && new TextEncoder().encode(value).length <= 512
  )
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error ? reason.message : '请求失败，请稍后重试。'
}

function submitLabel(mode: AuthMode): string {
  if (mode === 'login') return '登录'
  if (mode === 'register') return '创建账号并发送验证邮件'
  if (mode === 'forgot') return '发送密码重置邮件'
  if (mode === 'reset') return '保存新密码'
  return '重发验证邮件'
}

function intro(mode: AuthMode): string {
  if (mode === 'register')
    return '注册后请打开验证邮件中的链接，再使用邮箱和密码登录。'
  if (mode === 'verify')
    return '验证链接 24 小时有效，也可以填写邮箱重新发送验证邮件。'
  if (mode === 'forgot')
    return '如果邮箱已注册并完成验证，我们会发送密码重置链接。'
  if (mode === 'reset') return '设置新密码后，其他已登录会话会立即失效。'
  return '使用已验证的邮箱和密码继续学习。'
}
