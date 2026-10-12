import type { JSX } from 'react'
import { useEffect, useState } from 'react'

type IdentityState =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; userId: string }
  | { status: 'error' }

/** 显示服务端会话身份，并提供 OIDC 登录与本地会话退出操作。 */
export function AccountControl(): JSX.Element {
  const [identity, setIdentity] = useState<IdentityState>({ status: 'loading' })

  useEffect(() => {
    const controller = new AbortController()
    /** 同步页面首次加载时的服务端 session 状态。 */
    async function loadSession(): Promise<void> {
      try {
        const response = await fetch('/api/v1/auth/session', {
          credentials: 'same-origin',
          signal: controller.signal,
        })
        if (response.status === 401) {
          setIdentity({ status: 'anonymous' })
          return
        }
        if (!response.ok) throw new Error('session request failed')
        const payload: unknown = await response.json()
        if (
          typeof payload !== 'object' ||
          payload === null ||
          !('user_id' in payload) ||
          typeof payload.user_id !== 'string'
        ) {
          throw new Error('invalid session response')
        }
        setIdentity({ status: 'authenticated', userId: payload.user_id })
      } catch {
        if (!controller.signal.aborted) setIdentity({ status: 'error' })
      }
    }
    void loadSession()
    return () => {
      // 卸载时取消旧请求，避免过期结果更新界面。
      controller.abort()
    }
  }, [])

  /** 退出服务端 session，并清空当前界面的身份状态。 */
  async function logout(): Promise<void> {
    try {
      const response = await fetch('/api/v1/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      })
      if (response.ok) setIdentity({ status: 'anonymous' })
      else setIdentity({ status: 'error' })
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
        <span title={identity.userId}>已登录</span>
        <button type="button" onClick={() => void logout()}>
          退出
        </button>
      </div>
    )
  }
  if (identity.status === 'error') {
    return (
      <div className="account-control" role="status">
        <span>账号服务暂不可用</span>
        <a href="/api/v1/auth/login">重试登录</a>
      </div>
    )
  }
  return (
    <a className="account-control" href="/api/v1/auth/login">
      登录
    </a>
  )
}
