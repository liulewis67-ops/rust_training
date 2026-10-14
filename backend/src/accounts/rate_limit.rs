//! 基于 SQLite 的匿名账号操作固定窗口限流。

use sha2::{Digest, Sha256};

use super::store::{AccountStore, AccountStoreError};

/// 请求需要原子消耗的一个独立限流桶。
pub(super) struct RateLimitRequest {
    pub(super) scope: &'static str,
    pub(super) key_material: String,
    pub(super) max_hits: u32,
    pub(super) window_seconds: i64,
}

/// 原子消耗请求涉及的全部限流桶后的结果。
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(super) enum RateLimitDecision {
    Allowed,
    Limited { retry_after_seconds: u64 },
}

/// 在同一个 SQLite 事务中消耗请求涉及的全部固定窗口限流桶。
///
/// # Errors
/// 持久化失败时返回 `Unavailable`，不暴露 SQLite 诊断信息。
pub(super) async fn consume_limits(
    store: &AccountStore,
    requests: &[RateLimitRequest],
    now: i64,
) -> Result<RateLimitDecision, AccountStoreError> {
    let mut checks = requests
        .iter()
        .map(|request| {
            (
                hash_key(request.scope, &request.key_material),
                request.max_hits,
                request.window_seconds,
            )
        })
        .collect::<Vec<_>>();
    checks.sort_by(|left, right| left.0.cmp(&right.0));

    let mut transaction = store
        .pool
        .begin()
        .await
        .map_err(|_| AccountStoreError::Unavailable)?;
    for (key_hash, max_hits, window_seconds) in &checks {
        let next_expiry = now.saturating_add(*window_seconds);
        let updated = sqlx::query_scalar::<_, i64>(
            "INSERT INTO auth_rate_limits (key_hash, window_started_at, hit_count, expires_at) VALUES (?, ?, 1, ?) ON CONFLICT (key_hash) DO UPDATE SET window_started_at = CASE WHEN auth_rate_limits.expires_at <= ? THEN excluded.window_started_at ELSE auth_rate_limits.window_started_at END, hit_count = CASE WHEN auth_rate_limits.expires_at <= ? THEN 1 ELSE auth_rate_limits.hit_count + 1 END, expires_at = CASE WHEN auth_rate_limits.expires_at <= ? THEN excluded.expires_at ELSE auth_rate_limits.expires_at END WHERE auth_rate_limits.expires_at <= ? OR auth_rate_limits.hit_count < ? RETURNING expires_at",
        )
        .bind(key_hash)
        .bind(now)
        .bind(next_expiry)
        .bind(now)
        .bind(now)
        .bind(now)
        .bind(now)
        .bind(i64::from(*max_hits))
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|_| AccountStoreError::Unavailable)?;
        if updated.is_none() {
            let expires_at = sqlx::query_scalar::<_, i64>(
                "SELECT expires_at FROM auth_rate_limits WHERE key_hash = ?",
            )
            .bind(key_hash)
            .fetch_one(&mut *transaction)
            .await
            .map_err(|_| AccountStoreError::Unavailable)?;
            transaction
                .rollback()
                .await
                .map_err(|_| AccountStoreError::Unavailable)?;
            return Ok(RateLimitDecision::Limited {
                retry_after_seconds: expires_at.saturating_sub(now).max(1) as u64,
            });
        }
    }
    transaction
        .commit()
        .await
        .map_err(|_| AccountStoreError::Unavailable)?;
    Ok(RateLimitDecision::Allowed)
}

/// 对限流维度求哈希，避免存储的键泄漏邮箱地址或 IP。
fn hash_key(scope: &str, material: &str) -> String {
    let digest = Sha256::digest(format!("{scope}:{material}").as_bytes());
    format!("{digest:x}")
}
