//! Owner-scoped, immutable single-file run submissions awaiting an isolated worker.

use std::str::FromStr;

use axum::{
    Extension, Json, Router,
    extract::{DefaultBodyLimit, Path},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::{Row, SqlitePool, sqlite::SqliteConnectOptions, sqlite::SqlitePoolOptions};
use time::OffsetDateTime;
use tower_sessions::{Session, session::Id};

const USER_KEY: &str = "user_id";
const MAX_SOURCE_BYTES: usize = 64 * 1024;
const MAX_STDIN_BYTES: usize = 64 * 1024;
const MAX_REQUEST_BODY_BYTES: usize = 140 * 1024;
const MAX_IDENTIFIER_BYTES: usize = 128;

/// SQLite persistence for frozen run requests and their idempotency records.
#[derive(Clone, Debug)]
pub struct RunStore {
    pool: SqlitePool,
}

impl RunStore {
    /// Connect to the configured SQLite database and apply the additive run-task schema.
    ///
    /// # Errors
    /// Returns a SQLx error when opening the database or applying the migration fails.
    pub async fn connect(database_url: &str) -> Result<Self, sqlx::Error> {
        let options = SqliteConnectOptions::from_str(database_url)?.create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await?;
        sqlx::raw_sql(include_str!("../migrations/0007_run_tasks.sql"))
            .execute(&pool)
            .await?;
        Ok(Self { pool })
    }

    /// Insert one immutable task, or return its prior result for an identical retry.
    ///
    /// # Errors
    /// Returns a SQLx error when the transaction or row decoding fails.
    async fn create(
        &self,
        owner_id: &str,
        request: &CreateRunRequest,
    ) -> Result<CreateOutcome, sqlx::Error> {
        let mut transaction = self.pool.begin().await?;
        let existing = sqlx::query(
            "SELECT id, workspace_id, workspace_revision, request_hash, operation, source_hash, status, created_at \
             FROM run_tasks WHERE owner_id = ? AND idempotency_key = ?",
        )
        .bind(owner_id)
        .bind(&request.idempotency_key)
        .fetch_optional(&mut *transaction)
        .await?;
        if let Some(row) = existing {
            let task = decode_task(row)?;
            let request_hash = request_hash(request);
            transaction.commit().await?;
            return Ok(if task.request_hash == request_hash {
                CreateOutcome::Existing(task)
            } else {
                CreateOutcome::IdempotencyConflict
            });
        }

        let workspace =
            sqlx::query("SELECT revision, content FROM workspaces WHERE owner_id = ? AND id = ?")
                .bind(owner_id)
                .bind(&request.workspace_id)
                .fetch_optional(&mut *transaction)
                .await?;
        let Some(workspace) = workspace else {
            return Ok(CreateOutcome::WorkspaceNotFound);
        };
        let current_revision: i64 = workspace.try_get("revision")?;
        if current_revision != request.workspace_revision {
            return Ok(CreateOutcome::WorkspaceConflict);
        }
        let source_snapshot: String = workspace.try_get("content")?;
        if source_snapshot.len() > MAX_SOURCE_BYTES {
            return Ok(CreateOutcome::InputTooLarge);
        }
        let id = Id::default().to_string();
        let created_at = OffsetDateTime::now_utc().unix_timestamp();
        let request_hash = request_hash(request);
        let source_hash = hash_text(&source_snapshot);
        let inserted = sqlx::query(
            "INSERT INTO run_tasks \
             (id, owner_id, workspace_id, workspace_revision, idempotency_key, request_hash, source_hash, operation, source_snapshot, stdin, status, created_at) \
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?) \
             ON CONFLICT (owner_id, idempotency_key) DO NOTHING",
        )
        .bind(&id)
        .bind(owner_id)
        .bind(&request.workspace_id)
        .bind(request.workspace_revision)
        .bind(&request.idempotency_key)
        .bind(&request_hash)
        .bind(&source_hash)
        .bind(request.operation.as_str())
        .bind(&source_snapshot)
        .bind(&request.stdin)
        .bind(created_at)
        .execute(&mut *transaction)
        .await?;
        if inserted.rows_affected() == 0 {
            let row = sqlx::query(
                "SELECT id, workspace_id, workspace_revision, request_hash, operation, source_hash, status, created_at \
                 FROM run_tasks WHERE owner_id = ? AND idempotency_key = ?",
            )
            .bind(owner_id)
            .bind(&request.idempotency_key)
            .fetch_one(&mut *transaction)
            .await?;
            let task = decode_task(row)?;
            transaction.commit().await?;
            return Ok(if task.request_hash == request_hash {
                CreateOutcome::Existing(task)
            } else {
                CreateOutcome::IdempotencyConflict
            });
        }
        transaction.commit().await?;
        Ok(CreateOutcome::Created(RunTask {
            id,
            workspace_id: request.workspace_id.clone(),
            workspace_revision: request.workspace_revision,
            request_hash,
            operation: RunOperation::Run,
            source_hash,
            status: RunStatus::Queued,
            created_at,
        }))
    }

    /// Read one task only when its authenticated owner matches the stored owner.
    ///
    /// # Errors
    /// Returns a SQLx error when the query or row decoding fails.
    async fn get(&self, owner_id: &str, id: &str) -> Result<Option<RunTask>, sqlx::Error> {
        let row = sqlx::query(
            "SELECT id, workspace_id, workspace_revision, request_hash, operation, source_hash, status, created_at \
             FROM run_tasks WHERE owner_id = ? AND id = ?",
        )
        .bind(owner_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        row.map(decode_task).transpose()
    }
}

/// Mount authenticated run submission and owner-scoped status lookup routes.
pub fn router(store: RunStore) -> Router {
    Router::new()
        .route("/api/v1/runs", post(create_run))
        .route("/api/v1/runs/{id}", get(get_run))
        .layer(DefaultBodyLimit::max(MAX_REQUEST_BODY_BYTES))
        .layer(Extension(store))
}

/// Freeze the current cloud workspace revision into one queued run task.
async fn create_run(
    Extension(store): Extension<RunStore>,
    session: Session,
    Json(request): Json<CreateRunRequest>,
) -> Response {
    let owner_id = match session_owner(&session).await {
        Ok(owner_id) => owner_id,
        Err(response) => return response,
    };
    if !valid_identifier(&request.workspace_id)
        || !valid_identifier(&request.idempotency_key)
        || request.workspace_revision < 1
        || request.stdin.len() > MAX_STDIN_BYTES
    {
        return api_error(
            StatusCode::BAD_REQUEST,
            "invalid_run_request",
            "Run request fields are invalid or exceed their limits.",
        );
    }
    match store.create(&owner_id, &request).await {
        Ok(CreateOutcome::Created(task)) => (StatusCode::CREATED, Json(task)).into_response(),
        Ok(CreateOutcome::Existing(task)) => (StatusCode::OK, Json(task)).into_response(),
        Ok(CreateOutcome::IdempotencyConflict) => api_error(
            StatusCode::CONFLICT,
            "idempotency_key_conflict",
            "This idempotency key was already used for a different run request.",
        ),
        Ok(CreateOutcome::WorkspaceNotFound) => api_error(
            StatusCode::NOT_FOUND,
            "workspace_not_found",
            "Workspace was not found.",
        ),
        Ok(CreateOutcome::WorkspaceConflict) => api_error(
            StatusCode::CONFLICT,
            "workspace_revision_conflict",
            "Save the latest workspace revision before submitting it.",
        ),
        Ok(CreateOutcome::InputTooLarge) => api_error(
            StatusCode::PAYLOAD_TOO_LARGE,
            "run_input_too_large",
            "Workspace source exceeds the run-task limit.",
        ),
        Err(_) => storage_error(),
    }
}

/// Return a run status only to the authenticated owner of the task.
async fn get_run(
    Extension(store): Extension<RunStore>,
    session: Session,
    Path(id): Path<String>,
) -> Response {
    let owner_id = match session_owner(&session).await {
        Ok(owner_id) => owner_id,
        Err(response) => return response,
    };
    match store.get(&owner_id, &id).await {
        Ok(Some(task)) => Json(task).into_response(),
        Ok(None) => api_error(
            StatusCode::NOT_FOUND,
            "run_not_found",
            "Run task was not found.",
        ),
        Err(_) => storage_error(),
    }
}

/// Resolve the owner only from the server-managed authentication session.
async fn session_owner(session: &Session) -> Result<String, Response> {
    match session.get::<String>(USER_KEY).await {
        Ok(Some(owner_id)) if !owner_id.trim().is_empty() => Ok(owner_id),
        Ok(_) => Err(api_error(
            StatusCode::UNAUTHORIZED,
            "authentication_required",
            "Sign in to submit or read run tasks.",
        )),
        Err(_) => Err(storage_error()),
    }
}

/// Accept only bounded, printable identifiers for workspace and idempotency references.
fn valid_identifier(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= MAX_IDENTIFIER_BYTES
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b':'))
}

/// Hash request identity without concatenation ambiguity or storing source text in the hash field.
fn request_hash(request: &CreateRunRequest) -> String {
    let mut digest = Sha256::new();
    let workspace_revision = request.workspace_revision.to_string();
    for part in [
        request.workspace_id.as_bytes(),
        workspace_revision.as_bytes(),
        request.operation.as_str().as_bytes(),
        request.stdin.as_bytes(),
    ] {
        digest.update((part.len() as u64).to_be_bytes());
        digest.update(part);
    }
    format!("{:x}", digest.finalize())
}

/// Return a stable SHA-256 digest for an immutable source snapshot.
fn hash_text(value: &str) -> String {
    format!("{:x}", Sha256::digest(value.as_bytes()))
}

/// Decode the public task fields without returning the stored source or stdin snapshot.
fn decode_task(row: sqlx::sqlite::SqliteRow) -> Result<RunTask, sqlx::Error> {
    Ok(RunTask {
        id: row.try_get("id")?,
        workspace_id: row.try_get("workspace_id")?,
        workspace_revision: row.try_get("workspace_revision")?,
        request_hash: row.try_get("request_hash")?,
        operation: RunOperation::from_db(row.try_get("operation")?)?,
        source_hash: row.try_get("source_hash")?,
        status: RunStatus::from_db(row.try_get("status")?)?,
        created_at: row.try_get("created_at")?,
    })
}

/// Return a stable error DTO without exposing database details or filesystem paths.
fn api_error(status: StatusCode, code: &'static str, message: &'static str) -> Response {
    (
        status,
        Json(ApiError {
            code,
            message,
            retryable: false,
        }),
    )
        .into_response()
}

/// Hide SQLite errors behind a retryable service error.
fn storage_error() -> Response {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(ApiError {
            code: "run_storage_failed",
            message: "Run task storage is temporarily unavailable.",
            retryable: true,
        }),
    )
        .into_response()
}

/// Validated request shape; extra fields such as shell commands or environment overrides fail.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
struct CreateRunRequest {
    workspace_id: String,
    workspace_revision: i64,
    idempotency_key: String,
    operation: RunOperation,
    stdin: String,
}

/// Only the fixed single-file run operation is accepted by the first task-creation endpoint.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
enum RunOperation {
    Run,
}

impl RunOperation {
    /// Return the stable lowercase value stored in SQLite and sent to the browser.
    const fn as_str(self) -> &'static str {
        match self {
            Self::Run => "run",
        }
    }

    /// Decode the operation persisted in the task row.
    fn from_db(value: String) -> Result<Self, sqlx::Error> {
        match value.as_str() {
            "run" => Ok(Self::Run),
            _ => Err(sqlx::Error::Protocol("invalid run operation stored".into())),
        }
    }
}

/// State vocabulary reserved for the later isolated worker integration.
#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
enum RunStatus {
    Queued,
    Running,
    Succeeded,
    Failed,
}

impl RunStatus {
    /// Decode the persisted worker status without accepting arbitrary database text.
    fn from_db(value: String) -> Result<Self, sqlx::Error> {
        match value.as_str() {
            "queued" => Ok(Self::Queued),
            "running" => Ok(Self::Running),
            "succeeded" => Ok(Self::Succeeded),
            "failed" => Ok(Self::Failed),
            _ => Err(sqlx::Error::Protocol("invalid run status stored".into())),
        }
    }
}

/// Public task receipt; source and stdin remain server-side in the frozen snapshot.
#[derive(Debug, Serialize)]
struct RunTask {
    id: String,
    workspace_id: String,
    workspace_revision: i64,
    request_hash: String,
    operation: RunOperation,
    source_hash: String,
    status: RunStatus,
    created_at: i64,
}

/// Stable API error response.
#[derive(Serialize)]
struct ApiError {
    code: &'static str,
    message: &'static str,
    retryable: bool,
}

enum CreateOutcome {
    Created(RunTask),
    Existing(RunTask),
    IdempotencyConflict,
    WorkspaceNotFound,
    WorkspaceConflict,
    InputTooLarge,
}

#[cfg(test)]
mod tests {
    use axum::{
        Router,
        body::{Body, to_bytes},
        http::{Method, Request as HttpRequest, StatusCode, header},
        routing::get,
    };
    use serde_json::{Value, json};
    use tower::ServiceExt;
    use tower_sessions::{Session, SessionManagerLayer};

    use super::{MAX_SOURCE_BYTES, RunStore, USER_KEY, router};
    use crate::sessions::SqliteSessionStore;

    /// Seed a server-managed identity for tests without depending on a live auth provider.
    async fn seed_identity(
        axum::extract::Path(owner_id): axum::extract::Path<String>,
        session: Session,
    ) -> StatusCode {
        session
            .insert(USER_KEY, owner_id)
            .await
            .expect("SQLite session store should accept a test identity");
        StatusCode::NO_CONTENT
    }

    /// Build isolated run-task and session storage and seed one workspace table.
    async fn test_app() -> (Router, RunStore) {
        let store = RunStore::connect("sqlite::memory:")
            .await
            .expect("run-task schema should initialize");
        sqlx::query(
            "CREATE TABLE workspaces (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, revision INTEGER NOT NULL, content TEXT NOT NULL)",
        )
        .execute(&store.pool)
        .await
        .expect("workspace fixture schema should initialize");
        let session_store = SqliteSessionStore::connect("sqlite::memory:")
            .await
            .expect("session schema should initialize");
        let app = Router::new()
            .route("/test/session/{owner_id}", get(seed_identity))
            .merge(router(store.clone()))
            .layer(SessionManagerLayer::new(session_store).with_secure(false));
        (app, store)
    }

    /// Create one authenticated cookie for a simulated browser account.
    async fn session_cookie(app: &Router, owner_id: &str) -> String {
        let response = app
            .clone()
            .oneshot(
                HttpRequest::builder()
                    .uri(format!("/test/session/{owner_id}"))
                    .body(Body::empty())
                    .expect("test session request should be valid"),
            )
            .await
            .expect("test session route should respond");
        response
            .headers()
            .get(header::SET_COOKIE)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(';').next())
            .expect("authenticated test session should set a cookie")
            .to_owned()
    }

    /// Send one JSON API request with the selected browser session.
    async fn json_request(
        app: &Router,
        method: Method,
        uri: &str,
        cookie: Option<&str>,
        body: Option<Value>,
    ) -> axum::response::Response {
        let mut request = HttpRequest::builder()
            .method(method)
            .uri(uri)
            .header(header::CONTENT_TYPE, "application/json");
        if let Some(cookie) = cookie {
            request = request.header(header::COOKIE, cookie);
        }
        app.clone()
            .oneshot(
                request
                    .body(match body {
                        Some(value) => Body::from(value.to_string()),
                        None => Body::empty(),
                    })
                    .expect("JSON API request should be valid"),
            )
            .await
            .expect("run-task router should return a response")
    }

    /// Decode one API JSON response for stable field assertions.
    async fn response_json(response: axum::response::Response) -> Value {
        let bytes = to_bytes(response.into_body(), 160 * 1024)
            .await
            .expect("run-task response should fit its configured limit");
        serde_json::from_slice(&bytes).expect("run-task response should be JSON")
    }

    /// Seed one owner-scoped draft revision for run-task submissions.
    async fn seed_workspace(
        store: &RunStore,
        id: &str,
        owner_id: &str,
        revision: i64,
        source: &str,
    ) {
        sqlx::query("INSERT INTO workspaces (id, owner_id, revision, content) VALUES (?, ?, ?, ?)")
            .bind(id)
            .bind(owner_id)
            .bind(revision)
            .bind(source)
            .execute(&store.pool)
            .await
            .expect("workspace fixture should be inserted");
    }

    /// A queued task stores the exact workspace revision and exposes only its digest.
    #[tokio::test]
    async fn creates_and_reads_an_immutable_owner_scoped_run() {
        let (app, store) = test_app().await;
        seed_workspace(&store, "workspace-1", "learner-a", 1, "fn main() {}").await;
        let learner = session_cookie(&app, "learner-a").await;
        let request = json!({
            "workspace_id": "workspace-1",
            "workspace_revision": 1,
            "idempotency_key": "attempt-0001",
            "operation": "run",
            "stdin": "input\n"
        });
        let created = json_request(
            &app,
            Method::POST,
            "/api/v1/runs",
            Some(&learner),
            Some(request.clone()),
        )
        .await;
        assert_eq!(created.status(), StatusCode::CREATED);
        let task = response_json(created).await;
        assert_eq!(task["status"], "queued");
        assert_eq!(task["workspace_revision"], 1);
        assert_eq!(task["source_hash"], super::hash_text("fn main() {}"));
        assert_eq!(task["operation"], "run");
        assert!(task.get("source_snapshot").is_none());

        sqlx::query("UPDATE workspaces SET content = ?, revision = 2 WHERE id = ?")
            .bind("fn main() { panic!() }")
            .bind("workspace-1")
            .execute(&store.pool)
            .await
            .expect("workspace should advance after task creation");
        let stored_source: String =
            sqlx::query_scalar("SELECT source_snapshot FROM run_tasks WHERE id = ?")
                .bind(task["id"].as_str().expect("task id should be a string"))
                .fetch_one(&store.pool)
                .await
                .expect("frozen source should remain in the task row");
        assert_eq!(stored_source, "fn main() {}");

        let read = json_request(
            &app,
            Method::GET,
            &format!("/api/v1/runs/{}", task["id"].as_str().unwrap()),
            Some(&learner),
            None,
        )
        .await;
        assert_eq!(read.status(), StatusCode::OK);
        assert_eq!(response_json(read).await, task);

        let other = session_cookie(&app, "learner-b").await;
        let hidden = json_request(
            &app,
            Method::GET,
            &format!("/api/v1/runs/{}", task["id"].as_str().unwrap()),
            Some(&other),
            None,
        )
        .await;
        assert_eq!(hidden.status(), StatusCode::NOT_FOUND);
    }

    /// Repeated request keys are stable, while a changed request cannot reuse the key.
    #[tokio::test]
    async fn makes_run_creation_idempotent_and_rejects_key_reuse() {
        let (app, store) = test_app().await;
        seed_workspace(&store, "workspace-1", "learner-a", 1, "fn main() {}").await;
        let learner = session_cookie(&app, "learner-a").await;
        let request = json!({
            "workspace_id": "workspace-1",
            "workspace_revision": 1,
            "idempotency_key": "attempt-0001",
            "operation": "run",
            "stdin": ""
        });
        let (first, retry) = tokio::join!(
            json_request(
                &app,
                Method::POST,
                "/api/v1/runs",
                Some(&learner),
                Some(request.clone()),
            ),
            json_request(
                &app,
                Method::POST,
                "/api/v1/runs",
                Some(&learner),
                Some(request.clone()),
            ),
        );
        let first_status = first.status();
        let retry_status = retry.status();
        assert!(
            (first_status == StatusCode::CREATED && retry_status == StatusCode::OK)
                || (retry_status == StatusCode::CREATED && first_status == StatusCode::OK)
        );
        let first_task = response_json(first).await;
        assert_eq!(response_json(retry).await, first_task);
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM run_tasks")
            .fetch_one(&store.pool)
            .await
            .expect("task count should query");
        assert_eq!(count, 1);

        let reused = json_request(
            &app,
            Method::POST,
            "/api/v1/runs",
            Some(&learner),
            Some(json!({
                "workspace_id": "workspace-1",
                "workspace_revision": 1,
                "idempotency_key": "attempt-0001",
                "operation": "run",
                "stdin": "different input"
            })),
        )
        .await;
        assert_eq!(reused.status(), StatusCode::CONFLICT);
    }

    /// Authentication, workspace ownership, revision and request-shape checks fail closed.
    #[tokio::test]
    async fn rejects_unauthorized_stale_foreign_and_unbounded_run_requests() {
        let (app, store) = test_app().await;
        seed_workspace(&store, "workspace-1", "learner-a", 2, "fn main() {}").await;
        seed_workspace(&store, "workspace-foreign", "learner-b", 1, "fn main() {}").await;
        let learner = session_cookie(&app, "learner-a").await;
        let request = json!({
            "workspace_id": "workspace-1",
            "workspace_revision": 1,
            "idempotency_key": "attempt-0001",
            "operation": "run",
            "stdin": ""
        });
        let anonymous = json_request(
            &app,
            Method::POST,
            "/api/v1/runs",
            None,
            Some(request.clone()),
        )
        .await;
        assert_eq!(anonymous.status(), StatusCode::UNAUTHORIZED);

        let stale = json_request(
            &app,
            Method::POST,
            "/api/v1/runs",
            Some(&learner),
            Some(request),
        )
        .await;
        assert_eq!(stale.status(), StatusCode::CONFLICT);

        let foreign = json_request(
            &app,
            Method::POST,
            "/api/v1/runs",
            Some(&learner),
            Some(json!({
                "workspace_id": "workspace-foreign",
                "workspace_revision": 1,
                "idempotency_key": "attempt-foreign",
                "operation": "run",
                "stdin": ""
            })),
        )
        .await;
        assert_eq!(foreign.status(), StatusCode::NOT_FOUND);

        let command = json_request(
            &app,
            Method::POST,
            "/api/v1/runs",
            Some(&learner),
            Some(json!({
                "workspace_id": "workspace-1",
                "workspace_revision": 2,
                "idempotency_key": "attempt-shell",
                "operation": "run",
                "stdin": "",
                "shell": "whoami"
            })),
        )
        .await;
        assert_eq!(command.status(), StatusCode::UNPROCESSABLE_ENTITY);

        let operation = json_request(
            &app,
            Method::POST,
            "/api/v1/runs",
            Some(&learner),
            Some(json!({
                "workspace_id": "workspace-1",
                "workspace_revision": 2,
                "idempotency_key": "attempt-operation",
                "operation": "shell",
                "stdin": ""
            })),
        )
        .await;
        assert_eq!(operation.status(), StatusCode::UNPROCESSABLE_ENTITY);

        let large_input = json_request(
            &app,
            Method::POST,
            "/api/v1/runs",
            Some(&learner),
            Some(json!({
                "workspace_id": "workspace-1",
                "workspace_revision": 2,
                "idempotency_key": "attempt-large",
                "operation": "run",
                "stdin": "x".repeat(MAX_SOURCE_BYTES + 1)
            })),
        )
        .await;
        assert_eq!(large_input.status(), StatusCode::BAD_REQUEST);

        seed_workspace(
            &store,
            "workspace-large",
            "learner-a",
            1,
            &"x".repeat(MAX_SOURCE_BYTES + 1),
        )
        .await;
        let large_source = json_request(
            &app,
            Method::POST,
            "/api/v1/runs",
            Some(&learner),
            Some(json!({
                "workspace_id": "workspace-large",
                "workspace_revision": 1,
                "idempotency_key": "attempt-large-source",
                "operation": "run",
                "stdin": ""
            })),
        )
        .await;
        assert_eq!(large_source.status(), StatusCode::PAYLOAD_TOO_LARGE);
    }
}
