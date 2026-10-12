//! PostgreSQL-backed server session storage.

use std::time::Duration;

use async_trait::async_trait;
use sqlx::{PgPool, Row, postgres::PgPoolOptions};
use time::OffsetDateTime;
use tower_sessions::{
    session::{Id, Record},
    session_store::{self, SessionStore},
};

/// PostgreSQL session backend shared by API instances using the same database.
#[derive(Clone, Debug)]
pub struct PostgresSessionStore {
    pool: PgPool,
}

impl PostgresSessionStore {
    /// Connect to PostgreSQL and apply the additive session schema migration.
    pub async fn connect(database_url: &str) -> Result<Self, sqlx::Error> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await?;
        let store = Self { pool };
        store.migrate().await?;
        Ok(store)
    }

    /// Create session storage structures without changing existing application data.
    async fn migrate(&self) -> Result<(), sqlx::Error> {
        sqlx::raw_sql(include_str!("../migrations/0001_sessions.sql"))
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    /// Remove expired rows periodically so abandoned browser sessions do not accumulate.
    pub async fn delete_expired_periodically(self) {
        let mut interval = tokio::time::interval(Duration::from_secs(300));
        interval.tick().await;
        loop {
            interval.tick().await;
            if sqlx::query("DELETE FROM auth_sessions WHERE expiry_date <= now()")
                .execute(&self.pool)
                .await
                .is_err()
            {
                // Cleanup failure must not stop request handling; a later interval retries it.
                eprintln!("Expired session cleanup failed; it will retry on the next interval.");
            }
        }
    }
}

#[async_trait]
impl SessionStore for PostgresSessionStore {
    /// Insert a new session and regenerate its ID if a rare collision occurs.
    async fn create(&self, record: &mut Record) -> session_store::Result<()> {
        for _ in 0..3 {
            let data = encode_data(record)?;
            let result = sqlx::query(
                "INSERT INTO auth_sessions (id, data, expiry_date) VALUES ($1, $2, $3)",
            )
            .bind(record.id.to_string())
            .bind(data)
            .bind(record.expiry_date)
            .execute(&self.pool)
            .await;
            match result {
                Ok(_) => return Ok(()),
                Err(sqlx::Error::Database(error)) if error.code().as_deref() == Some("23505") => {
                    // Never overwrite a different live session when random IDs collide.
                    record.id = Id::default();
                }
                Err(_) => return Err(backend_error()),
            }
        }
        Err(backend_error())
    }

    /// Update an existing session snapshot without recreating a concurrently revoked session.
    async fn save(&self, record: &Record) -> session_store::Result<()> {
        sqlx::query("UPDATE auth_sessions SET data = $2, expiry_date = $3 WHERE id = $1")
            .bind(record.id.to_string())
            .bind(encode_data(record)?)
            .bind(record.expiry_date)
            .execute(&self.pool)
            .await
            .map_err(|_| backend_error())?;
        Ok(())
    }

    /// Load a session only while its server-side expiry remains in the future.
    async fn load(&self, session_id: &Id) -> session_store::Result<Option<Record>> {
        let row = sqlx::query(
            "SELECT data, expiry_date FROM auth_sessions WHERE id = $1 AND expiry_date > now()",
        )
        .bind(session_id.to_string())
        .fetch_optional(&self.pool)
        .await
        .map_err(|_| backend_error())?;
        row.map(|row| {
            let data: serde_json::Value = row.try_get("data").map_err(|_| backend_error())?;
            let expiry_date: OffsetDateTime =
                row.try_get("expiry_date").map_err(|_| backend_error())?;
            let data = serde_json::from_value(data)
                .map_err(|_| session_store::Error::Decode("invalid session payload".into()))?;
            Ok(Record {
                id: *session_id,
                data,
                expiry_date,
            })
        })
        .transpose()
    }

    /// Delete a session immediately to revoke its server-side cookie identity.
    async fn delete(&self, session_id: &Id) -> session_store::Result<()> {
        sqlx::query("DELETE FROM auth_sessions WHERE id = $1")
            .bind(session_id.to_string())
            .execute(&self.pool)
            .await
            .map_err(|_| backend_error())?;
        Ok(())
    }
}

/// Serialize session data as JSONB without exposing serialization details to callers.
fn encode_data(record: &Record) -> session_store::Result<serde_json::Value> {
    serde_json::to_value(&record.data)
        .map_err(|_| session_store::Error::Encode("session serialization failed".into()))
}

/// Return a redacted storage error so database details never enter an HTTP response.
fn backend_error() -> session_store::Error {
    session_store::Error::Backend("PostgreSQL session store operation failed".into())
}
