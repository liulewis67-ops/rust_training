//! 本地账号 SQLite 持久化与版本化 schema 迁移。

use std::{str::FromStr, time::Duration};

use sqlx::{Row, SqlitePool, sqlite::SqliteConnectOptions, sqlite::SqlitePoolOptions};
use time::OffsetDateTime;

use super::new_account_id;

/// 本地账号及认证元数据的 SQLite 持久化边界。
#[derive(Clone)]
pub struct AccountStore {
    pub(super) pool: SqlitePool,
}

impl AccountStore {
    /// 连接 SQLite 数据库并应用本地账号迁移。
    pub(crate) async fn connect(database_url: &str) -> Result<Self, sqlx::Error> {
        let options = SqliteConnectOptions::from_str(database_url)?
            .create_if_missing(true)
            .busy_timeout(Duration::from_secs(5));
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await?;
        let store = Self { pool };
        store.migrate().await?;
        Ok(store)
    }

    /// 定期清理已过期令牌和限流桶，失败时等待下一轮重试。
    pub(crate) async fn cleanup_expired_periodically(self) {
        let mut interval = tokio::time::interval(Duration::from_secs(300));
        loop {
            interval.tick().await;
            let now = OffsetDateTime::now_utc().unix_timestamp();
            if sqlx::query("DELETE FROM account_action_tokens WHERE expires_at <= ? OR consumed_at IS NOT NULL")
                .bind(now)
                .execute(&self.pool)
                .await
                .is_err()
            {
                eprintln!("Expired account token cleanup failed; it will retry on the next interval.");
            }
            if sqlx::query("DELETE FROM auth_rate_limits WHERE expires_at <= ?")
                .bind(now)
                .execute(&self.pool)
                .await
                .is_err()
            {
                eprintln!(
                    "Expired account rate-limit cleanup failed; it will retry on the next interval."
                );
            }
        }
    }

    /// 原子应用 schema 0006，并确保只添加一次 session owner 列。
    pub(super) async fn migrate(&self) -> Result<(), sqlx::Error> {
        let mut transaction = self.pool.begin().await?;
        sqlx::raw_sql(include_str!("../../migrations/0006_local_accounts.sql"))
            .execute(&mut *transaction)
            .await?;
        let applied = sqlx::query_scalar::<_, i64>(
            "SELECT EXISTS(SELECT 1 FROM auth_schema_migrations WHERE version = '0006')",
        )
        .fetch_one(&mut *transaction)
        .await?;
        if applied == 0 {
            let has_user_id = sqlx::query_scalar::<_, i64>(
                "SELECT EXISTS(SELECT 1 FROM pragma_table_info('auth_sessions') WHERE name = 'user_id')",
            )
            .fetch_one(&mut *transaction)
            .await?;
            if has_user_id == 0 {
                sqlx::query("ALTER TABLE auth_sessions ADD COLUMN user_id TEXT")
                    .execute(&mut *transaction)
                    .await?;
            }
            let now = OffsetDateTime::now_utc().unix_timestamp();
            sqlx::query(
                "INSERT INTO auth_schema_migrations (version, applied_at) VALUES ('0006', ?)",
            )
            .bind(now)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        Ok(())
    }

    /// 创建未验证账号并返回稳定的内部 UUID。
    ///
    /// # Errors
    /// 规范化邮箱冲突时返回 `EmailAlreadyExists`，存储失败时返回 `Unavailable`。
    #[cfg(test)]
    pub(super) async fn create_unverified(
        &self,
        email_normalized: &str,
        email_display: &str,
        password_hash: &str,
        now: i64,
    ) -> Result<String, AccountStoreError> {
        let account_id = new_account_id();
        let result = sqlx::query(
            "INSERT INTO accounts (id, email_normalized, email_display, password_hash, password_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&account_id)
        .bind(email_normalized)
        .bind(email_display)
        .bind(password_hash)
        .bind(now)
        .bind(now)
        .bind(now)
        .execute(&self.pool)
        .await;
        match result {
            Ok(_) => Ok(account_id),
            Err(sqlx::Error::Database(error)) if error.is_unique_violation() => {
                Err(AccountStoreError::EmailAlreadyExists)
            }
            Err(_) => Err(AccountStoreError::Unavailable),
        }
    }

    /// 在单一事务中创建未验证账号和验证令牌摘要。
    pub(super) async fn create_unverified_with_token(
        &self,
        email_normalized: &str,
        email_display: &str,
        password_hash: &str,
        token_hash: &str,
        expires_at: i64,
        now: i64,
    ) -> Result<String, AccountStoreError> {
        let account_id = new_account_id();
        let mut transaction = self
            .pool
            .begin()
            .await
            .map_err(|_| AccountStoreError::Unavailable)?;
        let inserted = sqlx::query(
            "INSERT INTO accounts (id, email_normalized, email_display, password_hash, password_changed_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(&account_id)
        .bind(email_normalized)
        .bind(email_display)
        .bind(password_hash)
        .bind(now)
        .bind(now)
        .bind(now)
        .execute(&mut *transaction)
        .await;
        match inserted {
            Ok(_) => {}
            Err(sqlx::Error::Database(error)) if error.is_unique_violation() => {
                return Err(AccountStoreError::EmailAlreadyExists);
            }
            Err(_) => return Err(AccountStoreError::Unavailable),
        }
        sqlx::query(
            "INSERT INTO account_action_tokens (token_hash, account_id, purpose, expires_at, created_at) VALUES (?, ?, 'verify_email', ?, ?)",
        )
        .bind(token_hash)
        .bind(&account_id)
        .bind(expires_at)
        .bind(now)
        .execute(&mut *transaction)
        .await
        .map_err(|_| AccountStoreError::Unavailable)?;
        transaction
            .commit()
            .await
            .map_err(|_| AccountStoreError::Unavailable)?;
        Ok(account_id)
    }

    /// 按规范化邮箱查找账号，不暴露持久化实现细节。
    ///
    /// # Errors
    /// SQLite 查询或解码失败时返回 `Unavailable`。
    pub(super) async fn find_by_email(
        &self,
        email_normalized: &str,
    ) -> Result<Option<AccountRecord>, AccountStoreError> {
        let row = sqlx::query(
            "SELECT id, email_display, password_hash, email_verified_at FROM accounts WHERE email_normalized = ?",
        )
        .bind(email_normalized)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| AccountStoreError::Unavailable)?;
        row.map(|row| {
            Ok(AccountRecord {
                id: row
                    .try_get("id")
                    .map_err(|_| AccountStoreError::Unavailable)?,
                email_display: row
                    .try_get("email_display")
                    .map_err(|_| AccountStoreError::Unavailable)?,
                password_hash: row
                    .try_get("password_hash")
                    .map_err(|_| AccountStoreError::Unavailable)?,
                email_verified_at: row
                    .try_get("email_verified_at")
                    .map_err(|_| AccountStoreError::Unavailable)?,
            })
        })
        .transpose()
    }

    /// 替换指定用途的未完成令牌，并原子持久化新摘要。
    ///
    /// # Errors
    /// 令牌替换无法提交时返回 `Unavailable`。
    pub(super) async fn replace_action_token(
        &self,
        account_id: &str,
        purpose: &'static str,
        token_hash: &str,
        expires_at: i64,
        now: i64,
    ) -> Result<(), AccountStoreError> {
        let mut transaction = self
            .pool
            .begin()
            .await
            .map_err(|_| AccountStoreError::Unavailable)?;
        sqlx::query(
            "DELETE FROM account_action_tokens WHERE account_id = ? AND purpose = ? AND consumed_at IS NULL",
        )
        .bind(account_id)
        .bind(purpose)
        .execute(&mut *transaction)
        .await
        .map_err(|_| AccountStoreError::Unavailable)?;
        sqlx::query(
            "INSERT INTO account_action_tokens (token_hash, account_id, purpose, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(token_hash)
        .bind(account_id)
        .bind(purpose)
        .bind(expires_at)
        .bind(now)
        .execute(&mut *transaction)
        .await
        .map_err(|_| AccountStoreError::Unavailable)?;
        transaction
            .commit()
            .await
            .map_err(|_| AccountStoreError::Unavailable)
    }

    /// 消耗有效邮箱验证令牌，并原子标记账号已验证。
    ///
    /// # Errors
    /// SQLite 失败时返回 `Unavailable`；无效、过期或重复令牌返回 `Ok(None)`。
    pub(super) async fn consume_verification_token(
        &self,
        token_hash: &str,
        now: i64,
    ) -> Result<Option<String>, AccountStoreError> {
        let mut transaction = self
            .pool
            .begin()
            .await
            .map_err(|_| AccountStoreError::Unavailable)?;
        let account_id = sqlx::query_scalar::<_, String>(
            "UPDATE account_action_tokens SET consumed_at = ? WHERE token_hash = ? AND purpose = 'verify_email' AND consumed_at IS NULL AND expires_at > ? RETURNING account_id",
        )
        .bind(now)
        .bind(token_hash)
        .bind(now)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|_| AccountStoreError::Unavailable)?;
        if let Some(account_id) = account_id {
            sqlx::query(
                "UPDATE accounts SET email_verified_at = COALESCE(email_verified_at, ?), updated_at = ? WHERE id = ?",
            )
            .bind(now)
            .bind(now)
            .bind(&account_id)
            .execute(&mut *transaction)
            .await
            .map_err(|_| AccountStoreError::Unavailable)?;
            transaction
                .commit()
                .await
                .map_err(|_| AccountStoreError::Unavailable)?;
            Ok(Some(account_id))
        } else {
            transaction
                .rollback()
                .await
                .map_err(|_| AccountStoreError::Unavailable)?;
            Ok(None)
        }
    }

    /// 消耗密码重置令牌、更新密码并原子撤销该账号的全部会话。
    ///
    /// # Errors
    /// 持久化失败时返回 `Unavailable`；过期或重放令牌返回 `Ok(None)`。
    pub(super) async fn reset_password(
        &self,
        token_hash: &str,
        password_hash: &str,
        now: i64,
    ) -> Result<Option<String>, AccountStoreError> {
        let mut transaction = self
            .pool
            .begin()
            .await
            .map_err(|_| AccountStoreError::Unavailable)?;
        let account_id = sqlx::query_scalar::<_, String>(
            "UPDATE account_action_tokens SET consumed_at = ? WHERE token_hash = ? AND purpose = 'reset_password' AND consumed_at IS NULL AND expires_at > ? RETURNING account_id",
        )
        .bind(now)
        .bind(token_hash)
        .bind(now)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|_| AccountStoreError::Unavailable)?;
        if let Some(account_id) = account_id {
            sqlx::query("UPDATE accounts SET password_hash = ?, password_changed_at = ?, updated_at = ? WHERE id = ?")
                .bind(password_hash)
                .bind(now)
                .bind(now)
                .bind(&account_id)
                .execute(&mut *transaction)
                .await
                .map_err(|_| AccountStoreError::Unavailable)?;
            sqlx::query("DELETE FROM auth_sessions WHERE user_id = ?")
                .bind(&account_id)
                .execute(&mut *transaction)
                .await
                .map_err(|_| AccountStoreError::Unavailable)?;
            transaction
                .commit()
                .await
                .map_err(|_| AccountStoreError::Unavailable)?;
            Ok(Some(account_id))
        } else {
            transaction
                .rollback()
                .await
                .map_err(|_| AccountStoreError::Unavailable)?;
            Ok(None)
        }
    }

    /// 按邮箱查找已验证账号，供密码找回流程使用。
    pub(super) async fn find_verified_by_email(
        &self,
        email_normalized: &str,
    ) -> Result<Option<(String, String)>, AccountStoreError> {
        sqlx::query_as::<_, (String, String)>(
            "SELECT id, email_display FROM accounts WHERE email_normalized = ? AND email_verified_at IS NOT NULL",
        )
        .bind(email_normalized)
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| AccountStoreError::Unavailable)
    }
}

/// 认证用例读取的账号字段。
pub(super) struct AccountRecord {
    pub(super) id: String,
    pub(super) email_display: String,
    pub(super) password_hash: String,
    pub(super) email_verified_at: Option<i64>,
}

/// 账号处理器使用的脱敏存储结果。
#[derive(Debug, PartialEq, Eq)]
pub(super) enum AccountStoreError {
    EmailAlreadyExists,
    Unavailable,
}
