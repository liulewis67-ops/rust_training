//! SQLite-backed server session storage.

use std::{str::FromStr, time::Duration};

use async_trait::async_trait;
use sqlx::{Row, SqlitePool, sqlite::SqliteConnectOptions, sqlite::SqlitePoolOptions};
use time::OffsetDateTime;
use tower_sessions::{
    session::{Id, Record},
    session_store::{self, SessionStore},
};

/// SQLite session backend shared by API instances using the same database file.
#[derive(Clone, Debug)]
pub struct SqliteSessionStore {
    pool: SqlitePool,
}

impl SqliteSessionStore {
    /// Connect to SQLite and apply the additive session schema migration.
    pub async fn connect(database_url: &str) -> Result<Self, sqlx::Error> {
        let options = SqliteConnectOptions::from_str(database_url)?.create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
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
        loop {
            interval.tick().await;
            let now = OffsetDateTime::now_utc().unix_timestamp();
            if sqlx::query("DELETE FROM auth_sessions WHERE expiry_unix <= ?")
                .bind(now)
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
impl SessionStore for SqliteSessionStore {
    /// Insert a new session and regenerate its ID if a rare collision occurs.
    async fn create(&self, record: &mut Record) -> session_store::Result<()> {
        for _ in 0..3 {
            let data = encode_data(record)?;
            let result =
                sqlx::query("INSERT INTO auth_sessions (id, data, expiry_unix) VALUES (?, ?, ?)")
                    .bind(record.id.to_string())
                    .bind(data)
                    .bind(record.expiry_date.unix_timestamp())
                    .execute(&self.pool)
                    .await;
            match result {
                Ok(_) => return Ok(()),
                Err(sqlx::Error::Database(error)) if error.is_unique_violation() => {
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
        sqlx::query("UPDATE auth_sessions SET data = ?, expiry_unix = ? WHERE id = ?")
            .bind(encode_data(record)?)
            .bind(record.expiry_date.unix_timestamp())
            .bind(record.id.to_string())
            .execute(&self.pool)
            .await
            .map_err(map_backend_error)?;
        Ok(())
    }

    /// Load a session only while its server-side expiry remains in the future.
    async fn load(&self, session_id: &Id) -> session_store::Result<Option<Record>> {
        let now = OffsetDateTime::now_utc().unix_timestamp();
        let row = sqlx::query(
            "SELECT data, expiry_unix FROM auth_sessions WHERE id = ? AND expiry_unix > ?",
        )
        .bind(session_id.to_string())
        .bind(now)
        .fetch_optional(&self.pool)
        .await
        .map_err(map_backend_error)?;
        row.map(|row| {
            // Decode both columns before rebuilding the record to reject malformed stored rows.
            let data: String = row.try_get("data").map_err(map_backend_error)?;
            let expiry_unix: i64 = row.try_get("expiry_unix").map_err(map_backend_error)?;
            let data = serde_json::from_str(&data)
                .map_err(|_| session_store::Error::Decode("invalid session payload".into()))?;
            let expiry_date = OffsetDateTime::from_unix_timestamp(expiry_unix)
                .map_err(|_| session_store::Error::Decode("invalid session expiry".into()))?;
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
        sqlx::query("DELETE FROM auth_sessions WHERE id = ?")
            .bind(session_id.to_string())
            .execute(&self.pool)
            .await
            .map_err(map_backend_error)?;
        Ok(())
    }
}

/// Serialize session data as JSON text without exposing serialization details to callers.
fn encode_data(record: &Record) -> session_store::Result<String> {
    match serde_json::to_string(&record.data) {
        Ok(data) => Ok(data),
        Err(_) => Err(session_store::Error::Encode(
            "session serialization failed".into(),
        )),
    }
}

/// Return a redacted storage error so database details never enter an HTTP response.
fn backend_error() -> session_store::Error {
    session_store::Error::Backend("SQLite session store operation failed".into())
}

/// Replace SQLx diagnostics with one generic error that cannot expose database details.
fn map_backend_error(_error: sqlx::Error) -> session_store::Error {
    backend_error()
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use axum::{
        Json, Router,
        body::to_bytes,
        http::{Request, StatusCode, header},
        routing::get,
    };
    use serde_json::{Value, json};
    use tower::ServiceExt;
    use tower_sessions::{Session, SessionManagerLayer, session::Id};

    use super::SqliteSessionStore;

    /// Seed a browser session so the file-backed test exercises the real session middleware.
    async fn seed_identity(session: Session) -> StatusCode {
        session
            .insert("user_id", "learner-persisted")
            .await
            .expect("SQLite should persist a test session");
        StatusCode::NO_CONTENT
    }

    /// Read the session value after another store instance opens the same SQLite file.
    async fn read_identity(session: Session) -> Result<Json<Value>, StatusCode> {
        session
            .get::<String>("user_id")
            .await
            .map(|user_id| user_id.map(|id| Json(json!({ "user_id": id }))))
            .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
            .ok_or(StatusCode::UNAUTHORIZED)
    }

    /// Verify that a session remains readable after its original SQLite pool is closed.
    #[tokio::test]
    async fn file_backed_session_survives_reopening_the_store() {
        let file_name = format!("session-persistence-{}.db", Id::default());
        let database_path = PathBuf::from("target").join(file_name);
        let database_url = format!(
            "sqlite://{}",
            database_path.to_string_lossy().replace('\\', "/")
        );
        let store = SqliteSessionStore::connect(&database_url)
            .await
            .expect("file-backed SQLite session store should initialize");
        let app = Router::new()
            .route("/seed", get(seed_identity))
            .route("/identity", get(read_identity))
            .layer(SessionManagerLayer::new(store.clone()).with_secure(false));
        let seeded = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/seed")
                    .body(axum::body::Body::empty())
                    .expect("test seed request should be valid"),
            )
            .await
            .expect("session middleware should seed an identity");
        assert_eq!(seeded.status(), StatusCode::NO_CONTENT);
        let cookie = seeded
            .headers()
            .get(header::SET_COOKIE)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(';').next())
            .expect("session middleware should issue a cookie")
            .to_owned();

        drop(app);
        store.pool.close().await;

        let reopened = SqliteSessionStore::connect(&database_url)
            .await
            .expect("a new SQLite pool should reopen the same session database");
        let app = Router::new()
            .route("/identity", get(read_identity))
            .layer(SessionManagerLayer::new(reopened.clone()).with_secure(false));
        let restored = app
            .oneshot(
                Request::builder()
                    .uri("/identity")
                    .header(header::COOKIE, cookie)
                    .body(axum::body::Body::empty())
                    .expect("test identity request should be valid"),
            )
            .await
            .expect("reopened session middleware should return a response");
        assert_eq!(restored.status(), StatusCode::OK);
        let body = to_bytes(restored.into_body(), 1024)
            .await
            .expect("session response should fit the test body limit");
        assert_eq!(
            serde_json::from_slice::<Value>(&body).expect("session response should be JSON"),
            json!({ "user_id": "learner-persisted" })
        );

        reopened.pool.close().await;
        std::fs::remove_file(&database_path)
            .expect("temporary SQLite session database should be removed");
    }
}
