import type { JSX } from 'react'
import { useCallback, useEffect, useState } from 'react'
import { AuthApiError, logout, readSession, type AuthSession } from './api'

type IdentityState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; session: AuthSession }
  | { status: 'error' }

/** 显示邮箱账号状态，并通过服务端会话退出。 */
export function AccountControl(): JSX.Element {
  const [identity, setIdentity] = useState<IdentityState>({ status: 'loading' })

  const refresh = useCallback(async () => {
    try {
      const session = await readSession()
      setIdentity({ status: 'authenticated', session })
    } catch (error) {
      setIdentity(
        error instanceof AuthApiError && error.status === 401
          ? { status: 'anonymous' }
          : { status: 'error' },
      )
    }
  }, [])

  useEffect(() => {
    void refresh()
    window.addEventListener('rust-path-session-changed', refresh)
    return () =>
      window.removeEventListener('rust-path-session-changed', refresh)
  }, [refresh])

  async function signOut(): Promise<void> {
    try {
      await logout()
    } catch {
      setIdentity({ status: 'error' })
    }
  }

  if (identity.status === 'loading') {
    return (
      <span className="account-control" role="status">
        正在读取账号…
      </span>
    )
  }
  if (identity.status === 'authenticated') {
    return (
      <div className="account-control">
        <span title={identity.session.email}>{identity.session.email}</span>
        <button type="button" onClick={() => void signOut()}>
          退出
        </button>
      </div>
    )
  }
  if (identity.status === 'error') {
    return (
      <div className="account-control" role="status">
        <span>账号服务暂不可用</span>
        <button type="button" onClick={() => void refresh()}>
          重试
        </button>
      </div>
    )
  }
  return (
    <a className="account-control" href="/login">
      登录
    </a>
  )
}
