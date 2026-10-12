//! Owner-scoped cloud drafts with optimistic revisions and durable conflict copies.

use std::str::FromStr;

use axum::{
    Extension, Json, Router,
    extract::{DefaultBodyLimit, Path, Query},
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool, sqlite::SqliteConnectOptions, sqlite::SqlitePoolOptions};
use time::OffsetDateTime;
use tower_sessions::{Session, session::Id};

const USER_KEY: &str = "user_id";
const MAX_WORKSPACE_CONTENT_BYTES: usize = 64 * 1024;
const MAX_REQUEST_BODY_BYTES: usize = 70 * 1024;
const MAX_CONFLICTS_PER_RESPONSE: i64 = 50;

/// SQLite persistence for cloud workspaces and immutable stale-save copies.
#[derive(Clone, Debug)]
pub struct WorkspaceStore {
    pool: SqlitePool,
}

impl WorkspaceStore {
    /// Connect to the configured SQLite file and apply additive workspace tables.
    ///
    /// # Errors
    /// Returns a SQLx error when opening the file or applying the migration fails.
    pub async fn connect(database_url: &str) -> Result<Self, sqlx::Error> {
        let options = SqliteConnectOptions::from_str(database_url)?.create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await?;
        sqlx::raw_sql(include_str!("../migrations/0002_workspaces.sql"))
            .execute(&pool)
            .await?;
        Ok(Self { pool })
    }

    /// Create one workspace or return the existing row for the same owner and template scope.
    ///
    /// # Errors
    /// Returns a SQLx error when the insert or owner-scoped lookup fails.
    async fn create_or_get(
        &self,
        owner_id: &str,
        request: &CreateWorkspaceRequest,
    ) -> Result<(Workspace, bool), sqlx::Error> {
        let id = Id::default().to_string();
        let now = OffsetDateTime::now_utc().unix_timestamp();
        let inserted = sqlx::query(
            "INSERT INTO workspaces (id, owner_id, lesson_id, item_id, template_version, content, revision, updated_at) \
             VALUES (?, ?, ?, ?, ?, ?, 1, ?) \
             ON CONFLICT (owner_id, lesson_id, item_id, template_version) DO NOTHING",
        )
        .bind(id)
        .bind(owner_id)
        .bind(&request.lesson_id)
        .bind(&request.item_id)
        .bind(&request.template_version)
        .bind(&request.content)
        .bind(now)
        .execute(&self.pool)
        .await?;
        let created = inserted.rows_affected() == 1;
        let row = sqlx::query(
            "SELECT id, lesson_id, item_id, template_version, content, revision \
             FROM workspaces WHERE owner_id = ? AND lesson_id = ? AND item_id = ? AND template_version = ?",
        )
        .bind(owner_id)
        .bind(&request.lesson_id)
        .bind(&request.item_id)
        .bind(&request.template_version)
        .fetch_one(&self.pool)
        .await?;
        Ok((decode_workspace(row)?, created))
    }

    /// Find a workspace by owner and stable editor scope without exposing other owners' rows.
    ///
    /// # Errors
    /// Returns a SQLx error when the SQLite query or row decoding fails.
    async fn get_by_scope(
        &self,
        owner_id: &str,
        scope: &WorkspaceScope,
    ) -> Result<Option<Workspace>, sqlx::Error> {
        let row = sqlx::query(
            "SELECT id, lesson_id, item_id, template_version, content, revision \
             FROM workspaces WHERE owner_id = ? AND lesson_id = ? AND item_id = ? AND template_version = ?",
        )
        .bind(owner_id)
        .bind(&scope.lesson_id)
        .bind(&scope.item_id)
        .bind(&scope.template_version)
        .fetch_optional(&self.pool)
        .await?;
        row.map(decode_workspace).transpose()
    }

    /// Read one workspace only when its server-side owner matches the authenticated session.
    ///
    /// # Errors
    /// Returns a SQLx error when the SQLite query or row decoding fails.
    async fn get(&self, owner_id: &str, id: &str) -> Result<Option<Workspace>, sqlx::Error> {
        let row = sqlx::query(
            "SELECT id, lesson_id, item_id, template_version, content, revision \
             FROM workspaces WHERE owner_id = ? AND id = ?",
        )
        .bind(owner_id)
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;
        row.map(decode_workspace).transpose()
    }

    /// Save against an exact revision or persist the submitted text as a conflict copy.
    ///
    /// # Errors
    /// Returns a SQLx error when updating the workspace or saving a conflict copy fails.
    async fn save(
        &self,
        owner_id: &str,
        id: &str,
        request: &SaveWorkspaceRequest,
    ) -> Result<SaveOutcome, sqlx::Error> {
        let now = OffsetDateTime::now_utc().unix_timestamp();
        let updated = sqlx::query(
            "UPDATE workspaces SET content = ?, revision = revision + 1, updated_at = ? \
             WHERE owner_id = ? AND id = ? AND revision = ? AND revision < 9223372036854775807",
        )
        .bind(&request.content)
        .bind(now)
        .bind(owner_id)
        .bind(id)
        .bind(request.revision)
        .execute(&self.pool)
        .await?;
        if updated.rows_affected() == 1 {
            let workspace = self
                .get(owner_id, id)
                .await?
                .ok_or(sqlx::Error::RowNotFound)?;
            return Ok(SaveOutcome::Saved(workspace));
        }

        let Some(latest) = self.get(owner_id, id).await? else {
            return Ok(SaveOutcome::NotFound);
        };
        let conflict_id = Id::default().to_string();
        sqlx::query(
            "INSERT INTO workspace_conflicts (id, workspace_id, owner_id, submitted_revision, content, created_at) \
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(&conflict_id)
        .bind(id)
        .bind(owner_id)
        .bind(request.revision)
        .bind(&request.content)
        .bind(now)
        .execute(&self.pool)
        .await?;
        Ok(SaveOutcome::Conflict {
            latest,
            conflict: WorkspaceConflict {
                id: conflict_id,
                submitted_revision: request.revision,
                content: request.content.clone(),
            },
        })
    }

    /// Resolve a displayed conflict while retaining the displaced cloud copy in history.
    ///
    /// # Errors
    /// Returns a SQLx error when the transaction or revision update fails.
    async fn resolve_keep_local(
        &self,
        owner_id: &str,
        id: &str,
        request: &SaveWorkspaceRequest,
    ) -> Result<SaveOutcome, sqlx::Error> {
        let mut transaction = self.pool.begin().await?;
        let row = sqlx::query(
            "SELECT id, lesson_id, item_id, template_version, content, revision \
             FROM workspaces WHERE owner_id = ? AND id = ?",
        )
        .bind(owner_id)
        .bind(id)
        .fetch_optional(&mut *transaction)
        .await?;
        let Some(row) = row else {
            return Ok(SaveOutcome::NotFound);
        };
        let latest = decode_workspace(row)?;
        let now = OffsetDateTime::now_utc().unix_timestamp();
        let conflict_id = Id::default().to_string();

        if latest.revision != request.revision {
            sqlx::query(
                "INSERT INTO workspace_conflicts (id, workspace_id, owner_id, submitted_revision, content, created_at) \
                 VALUES (?, ?, ?, ?, ?, ?)",
            )
            .bind(&conflict_id)
            .bind(id)
            .bind(owner_id)
            .bind(request.revision)
            .bind(&request.content)
            .bind(now)
            .execute(&mut *transaction)
            .await?;
            transaction.commit().await?;
            return Ok(SaveOutcome::Conflict {
                latest,
                conflict: WorkspaceConflict {
                    id: conflict_id,
                    submitted_revision: request.revision,
                    content: request.content.clone(),
                },
            });
        }

        // The learner explicitly chose the local copy. Archive the displaced cloud text first.
        sqlx::query(
            "INSERT INTO workspace_conflicts (id, workspace_id, owner_id, submitted_revision, content, created_at) \
             VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(conflict_id)
        .bind(id)
        .bind(owner_id)
        .bind(latest.revision)
        .bind(&latest.content)
        .bind(now)
        .execute(&mut *transaction)
        .await?;
        let updated = sqlx::query(
            "UPDATE workspaces SET content = ?, revision = revision + 1, updated_at = ? \
             WHERE owner_id = ? AND id = ? AND revision = ? AND revision < 9223372036854775807",
        )
        .bind(&request.content)
        .bind(now)
        .bind(owner_id)
        .bind(id)
        .bind(request.revision)
        .execute(&mut *transaction)
        .await?;
        if updated.rows_affected() != 1 {
            transaction.rollback().await?;
            return Err(sqlx::Error::Protocol(
                "workspace revision changed during conflict resolution".into(),
            ));
        }
        let row = sqlx::query(
            "SELECT id, lesson_id, item_id, template_version, content, revision \
             FROM workspaces WHERE owner_id = ? AND id = ?",
        )
        .bind(owner_id)
        .bind(id)
        .fetch_one(&mut *transaction)
        .await?;
        let workspace = decode_workspace(row)?;
        transaction.commit().await?;
        Ok(SaveOutcome::Saved(workspace))
    }

    /// Load saved conflict copies only for the owning user and workspace.
    ///
    /// # Errors
    /// Returns a SQLx error when the owner check, query, or row decoding fails.
    async fn conflicts(
        &self,
        owner_id: &str,
        workspace_id: &str,
    ) -> Result<Option<Vec<WorkspaceConflict>>, sqlx::Error> {
        if self.get(owner_id, workspace_id).await?.is_none() {
            return Ok(None);
        }
        let rows = sqlx::query(
            "SELECT id, submitted_revision, content FROM workspace_conflicts \
             WHERE owner_id = ? AND workspace_id = ? ORDER BY created_at DESC, id DESC LIMIT ?",
        )
        .bind(owner_id)
        .bind(workspace_id)
        .bind(MAX_CONFLICTS_PER_RESPONSE)
        .fetch_all(&self.pool)
        .await?;
        rows.into_iter()
            .map(decode_conflict)
            .collect::<Result<Vec<_>, _>>()
            .map(Some)
    }
}

/// Mount owner-scoped workspace routes and cap request bodies before JSON extraction.
pub fn router(store: WorkspaceStore) -> Router {
    Router::new()
        .route("/api/v1/workspaces", post(create_workspace))
        .route("/api/v1/workspaces/by-scope", get(get_by_scope))
        .route(
            "/api/v1/workspaces/{id}",
            get(get_workspace).put(save_workspace),
        )
        .route("/api/v1/workspaces/{id}/resolve", post(resolve_workspace))
        .route("/api/v1/workspaces/{id}/conflicts", get(get_conflicts))
        .layer(DefaultBodyLimit::max(MAX_REQUEST_BODY_BYTES))
        .layer(Extension(store))
}

/// Create or retrieve this owner's workspace for one lesson, item and template version.
async fn create_workspace(
    Extension(store): Extension<WorkspaceStore>,
    session: Session,
    Json(request): Json<CreateWorkspaceRequest>,
) -> Response {
    let owner_id = match session_owner(&session).await {
        Ok(owner_id) => owner_id,
        Err(response) => return response,
    };
    if !valid_scope(
        &request.lesson_id,
        &request.item_id,
        &request.template_version,
    ) || !valid_content(&request.content)
    {
        return api_error(
            StatusCode::BAD_REQUEST,
            "invalid_workspace",
            "Workspace scope or content is invalid.",
        );
    }
    match store.create_or_get(&owner_id, &request).await {
        Ok((workspace, true)) => (StatusCode::CREATED, Json(workspace)).into_response(),
        Ok((workspace, false)) => (StatusCode::OK, Json(workspace)).into_response(),
        Err(_) => storage_error(),
    }
}

/// Retrieve the latest workspace for this owner and editor scope on another device.
async fn get_by_scope(
    Extension(store): Extension<WorkspaceStore>,
    session: Session,
    Query(scope): Query<WorkspaceScope>,
) -> Response {
    let owner_id = match session_owner(&session).await {
        Ok(owner_id) => owner_id,
        Err(response) => return response,
    };
    if !valid_scope(&scope.lesson_id, &scope.item_id, &scope.template_version) {
        return api_error(
            StatusCode::BAD_REQUEST,
            "invalid_workspace_scope",
            "Workspace scope is invalid.",
        );
    }
    match store.get_by_scope(&owner_id, &scope).await {
        Ok(Some(workspace)) => Json(workspace).into_response(),
        Ok(None) => workspace_not_found(),
        Err(_) => storage_error(),
    }
}

/// Retrieve a workspace only when its owner matches the authenticated server session.
async fn get_workspace(
    Extension(store): Extension<WorkspaceStore>,
    session: Session,
    Path(id): Path<String>,
) -> Response {
    let owner_id = match session_owner(&session).await {
        Ok(owner_id) => owner_id,
        Err(response) => return response,
    };
    match store.get(&owner_id, &id).await {
        Ok(Some(workspace)) => Json(workspace).into_response(),
        Ok(None) => workspace_not_found(),
        Err(_) => storage_error(),
    }
}

/// Save a draft with compare-and-swap revision semantics and retain stale text as a conflict.
async fn save_workspace(
    Extension(store): Extension<WorkspaceStore>,
    session: Session,
    Path(id): Path<String>,
    Json(request): Json<SaveWorkspaceRequest>,
) -> Response {
    let owner_id = match session_owner(&session).await {
        Ok(owner_id) => owner_id,
        Err(response) => return response,
    };
    if request.revision < 1 || !valid_content(&request.content) {
        return api_error(
            StatusCode::BAD_REQUEST,
            "invalid_workspace_revision",
            "Workspace revision or content is invalid.",
        );
    }
    match store.save(&owner_id, &id, &request).await {
        Ok(SaveOutcome::Saved(workspace)) => Json(workspace).into_response(),
        Ok(SaveOutcome::Conflict { latest, conflict }) => (
            StatusCode::CONFLICT,
            Json(WorkspaceConflictResponse {
                code: "workspace_revision_conflict",
                message: "The workspace changed on another device. Both versions were preserved.",
                latest,
                conflict,
            }),
        )
            .into_response(),
        Ok(SaveOutcome::NotFound) => workspace_not_found(),
        Err(_) => storage_error(),
    }
}

/// Keep the local version after a conflict and archive the cloud version being replaced.
async fn resolve_workspace(
    Extension(store): Extension<WorkspaceStore>,
    session: Session,
    Path(id): Path<String>,
    Json(request): Json<SaveWorkspaceRequest>,
) -> Response {
    let owner_id = match session_owner(&session).await {
        Ok(owner_id) => owner_id,
        Err(response) => return response,
    };
    if request.revision < 1 || !valid_content(&request.content) {
        return api_error(
            StatusCode::BAD_REQUEST,
            "invalid_workspace_revision",
            "Workspace revision or content is invalid.",
        );
    }
    match store.resolve_keep_local(&owner_id, &id, &request).await {
        Ok(SaveOutcome::Saved(workspace)) => Json(workspace).into_response(),
        Ok(SaveOutcome::Conflict { latest, conflict }) => (
            StatusCode::CONFLICT,
            Json(WorkspaceConflictResponse {
                code: "workspace_revision_conflict",
                message: "The workspace changed on another device. Both versions were preserved.",
                latest,
                conflict,
            }),
        )
            .into_response(),
        Ok(SaveOutcome::NotFound) => workspace_not_found(),
        Err(_) => storage_error(),
    }
}

/// List a bounded number of saved conflict copies for the owning user.
async fn get_conflicts(
    Extension(store): Extension<WorkspaceStore>,
    session: Session,
    Path(id): Path<String>,
) -> Response {
    let owner_id = match session_owner(&session).await {
        Ok(owner_id) => owner_id,
        Err(response) => return response,
    };
    match store.conflicts(&owner_id, &id).await {
        Ok(Some(conflicts)) => Json(WorkspaceConflictsResponse { conflicts }).into_response(),
        Ok(None) => workspace_not_found(),
        Err(_) => storage_error(),
    }
}

/// Resolve the authenticated owner only from the server-managed session.
///
/// # Errors
/// Returns an HTTP 401 response when no signed-in owner exists, or 500 on session storage failure.
async fn session_owner(session: &Session) -> Result<String, Response> {
    match session.get::<String>(USER_KEY).await {
        Ok(Some(owner_id)) if !owner_id.trim().is_empty() => Ok(owner_id),
        Ok(_) => Err(api_error(
            StatusCode::UNAUTHORIZED,
            "authentication_required",
            "Sign in to access cloud workspaces.",
        )),
        Err(_) => Err(storage_error()),
    }
}

/// Validate short stable identifiers before they become indexed database scope fields.
fn valid_scope(lesson_id: &str, item_id: &str, template_version: &str) -> bool {
    [lesson_id, item_id, template_version]
        .iter()
        .all(|value| !value.trim().is_empty() && value.len() <= 128)
}

/// Bound UTF-8 content bytes so storage and synchronization stay within the R1 draft budget.
fn valid_content(content: &str) -> bool {
    content.len() <= MAX_WORKSPACE_CONTENT_BYTES
}

/// Convert one SQLite row to the stable workspace response shape.
///
/// # Errors
/// Returns a SQLx error if a required field is missing or has an incompatible type.
fn decode_workspace(row: sqlx::sqlite::SqliteRow) -> Result<Workspace, sqlx::Error> {
    Ok(Workspace {
        id: row.try_get("id")?,
        lesson_id: row.try_get("lesson_id")?,
        item_id: row.try_get("item_id")?,
        template_version: row.try_get("template_version")?,
        content: row.try_get("content")?,
        revision: row.try_get("revision")?,
    })
}

/// Convert one stored stale-save row to the conflict response shape.
///
/// # Errors
/// Returns a SQLx error if a required field is missing or has an incompatible type.
fn decode_conflict(row: sqlx::sqlite::SqliteRow) -> Result<WorkspaceConflict, sqlx::Error> {
    Ok(WorkspaceConflict {
        id: row.try_get("id")?,
        submitted_revision: row.try_get("submitted_revision")?,
        content: row.try_get("content")?,
    })
}

/// Return a stable error DTO without exposing SQLite details or filesystem paths.
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

/// Hide resource existence and owner mismatches behind the same not-found response.
fn workspace_not_found() -> Response {
    api_error(
        StatusCode::NOT_FOUND,
        "workspace_not_found",
        "Workspace was not found.",
    )
}

/// Map all persistence failures to a generic retryable response.
fn storage_error() -> Response {
    api_error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "workspace_storage_failed",
        "Workspace storage is temporarily unavailable.",
    )
}

/// Request body for idempotent workspace creation by stable editor scope.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct CreateWorkspaceRequest {
    lesson_id: String,
    item_id: String,
    template_version: String,
    content: String,
}

/// Query identifying the authenticated user's template-scoped workspace.
#[derive(Deserialize)]
struct WorkspaceScope {
    lesson_id: String,
    item_id: String,
    template_version: String,
}

/// Request body for a conditional save against the last known revision.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SaveWorkspaceRequest {
    revision: i64,
    content: String,
}

/// Workspace data returned to the authenticated owner.
#[derive(Clone, Deserialize, Serialize)]
struct Workspace {
    id: String,
    lesson_id: String,
    item_id: String,
    template_version: String,
    content: String,
    revision: i64,
}

/// Durable stale-save content retained separately from the latest workspace revision.
#[derive(Deserialize, Serialize)]
struct WorkspaceConflict {
    id: String,
    submitted_revision: i64,
    content: String,
}

/// Latest revision plus the submitted copy returned when a save loses a revision race.
#[derive(Serialize)]
struct WorkspaceConflictResponse {
    code: &'static str,
    message: &'static str,
    latest: Workspace,
    conflict: WorkspaceConflict,
}

/// Bounded conflict-history response for an owning workspace.
#[derive(Serialize)]
struct WorkspaceConflictsResponse {
    conflicts: Vec<WorkspaceConflict>,
}

/// Stable API error envelope with a retry hint for clients.
#[derive(Serialize)]
struct ApiError {
    code: &'static str,
    message: &'static str,
    retryable: bool,
}

enum SaveOutcome {
    Saved(Workspace),
    Conflict {
        latest: Workspace,
        conflict: WorkspaceConflict,
    },
    NotFound,
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

    use super::{USER_KEY, WorkspaceStore, router};
    use crate::sessions::SqliteSessionStore;

    /// Seed an identity only inside API tests, without a live OIDC provider.
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

    /// Build the real workspace and SQLite session routers for one isolated test database.
    async fn test_app() -> Router {
        let workspace_store = WorkspaceStore::connect("sqlite::memory:")
            .await
            .expect("workspace schema should initialize");
        let session_store = SqliteSessionStore::connect("sqlite::memory:")
            .await
            .expect("session schema should initialize");
        Router::new()
            .route("/test/session/{owner_id}", get(seed_identity))
            .merge(router(workspace_store))
            .layer(SessionManagerLayer::new(session_store).with_secure(false))
    }

    /// Create one independent authenticated test cookie for a simulated device.
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

    /// Send a JSON API request while preserving one test device's session cookie.
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
            .expect("workspace router should return a response")
    }

    /// Decode one bounded workspace response for field-level API assertions.
    async fn response_json(response: axum::response::Response) -> Value {
        let bytes = to_bytes(response.into_body(), 80 * 1024)
            .await
            .expect("workspace response should fit its configured limit");
        serde_json::from_slice(&bytes).expect("workspace response should be JSON")
    }

    /// Verify another device restores the latest revision and stale saves preserve both copies.
    #[tokio::test]
    async fn synchronizes_devices_and_keeps_stale_conflict_content() {
        let app = test_app().await;
        let first_device = session_cookie(&app, "learner-a").await;
        let second_device = session_cookie(&app, "learner-a").await;
        let scope_query = "lesson_id=M01-L01&item_id=main.rs&template_version=starter-v1";
        let created = json_request(
            &app,
            Method::POST,
            "/api/v1/workspaces",
            Some(&first_device),
            Some(json!({
                "lesson_id": "M01-L01",
                "item_id": "main.rs",
                "template_version": "starter-v1",
                "content": "starter"
            })),
        )
        .await;
        assert_eq!(created.status(), StatusCode::CREATED);
        let workspace = response_json(created).await;
        let workspace_id = workspace["id"]
            .as_str()
            .expect("workspace should have an opaque ID")
            .to_owned();

        let restored = json_request(
            &app,
            Method::GET,
            &format!("/api/v1/workspaces/by-scope?{scope_query}"),
            Some(&second_device),
            None,
        )
        .await;
        assert_eq!(restored.status(), StatusCode::OK);
        let restored = response_json(restored).await;
        assert_eq!(restored["id"], workspace_id);
        assert_eq!(restored["content"], "starter");

        let saved = json_request(
            &app,
            Method::PUT,
            &format!("/api/v1/workspaces/{workspace_id}"),
            Some(&first_device),
            Some(json!({ "revision": 1, "content": "device one edit" })),
        )
        .await;
        assert_eq!(saved.status(), StatusCode::OK);
        assert_eq!(response_json(saved).await["revision"], 2);

        let conflict = json_request(
            &app,
            Method::PUT,
            &format!("/api/v1/workspaces/{workspace_id}"),
            Some(&second_device),
            Some(json!({ "revision": 1, "content": "device two edit" })),
        )
        .await;
        assert_eq!(conflict.status(), StatusCode::CONFLICT);
        let conflict = response_json(conflict).await;
        assert_eq!(conflict["latest"]["content"], "device one edit");
        assert_eq!(conflict["conflict"]["content"], "device two edit");

        let conflict_history = json_request(
            &app,
            Method::GET,
            &format!("/api/v1/workspaces/{workspace_id}/conflicts"),
            Some(&first_device),
            None,
        )
        .await;
        assert_eq!(conflict_history.status(), StatusCode::OK);
        let conflict_history = response_json(conflict_history).await;
        assert_eq!(
            conflict_history["conflicts"][0]["content"],
            "device two edit"
        );

        let resolved = json_request(
            &app,
            Method::POST,
            &format!("/api/v1/workspaces/{workspace_id}/resolve"),
            Some(&second_device),
            Some(json!({ "revision": 2, "content": "device two edit" })),
        )
        .await;
        assert_eq!(resolved.status(), StatusCode::OK);
        assert_eq!(response_json(resolved).await["revision"], 3);

        let conflict_history = json_request(
            &app,
            Method::GET,
            &format!("/api/v1/workspaces/{workspace_id}/conflicts"),
            Some(&second_device),
            None,
        )
        .await;
        let conflict_history = response_json(conflict_history).await;
        assert!(
            conflict_history["conflicts"]
                .as_array()
                .expect("conflict history should be an array")
                .iter()
                .any(|conflict| conflict["content"] == "device one edit")
        );
    }

    /// Verify owner identity comes from the server session and unknown owners see no resource.
    #[tokio::test]
    async fn rejects_anonymous_and_cross_owner_workspace_access() {
        let app = test_app().await;
        let owner_cookie = session_cookie(&app, "learner-a").await;
        let other_cookie = session_cookie(&app, "learner-b").await;
        let created = json_request(
            &app,
            Method::POST,
            "/api/v1/workspaces",
            Some(&owner_cookie),
            Some(json!({
                "lesson_id": "M01-L01",
                "item_id": "main.rs",
                "template_version": "starter-v1",
                "content": "private draft"
            })),
        )
        .await;
        let workspace = response_json(created).await;
        let workspace_id = workspace["id"].as_str().unwrap();

        let anonymous = json_request(
            &app,
            Method::GET,
            &format!("/api/v1/workspaces/{workspace_id}"),
            None,
            None,
        )
        .await;
        assert_eq!(anonymous.status(), StatusCode::UNAUTHORIZED);

        let foreign_read = json_request(
            &app,
            Method::GET,
            &format!("/api/v1/workspaces/{workspace_id}"),
            Some(&other_cookie),
            None,
        )
        .await;
        assert_eq!(foreign_read.status(), StatusCode::NOT_FOUND);

        let foreign_write = json_request(
            &app,
            Method::PUT,
            &format!("/api/v1/workspaces/{workspace_id}"),
            Some(&other_cookie),
            Some(json!({ "revision": 1, "content": "overwrite attempt" })),
        )
        .await;
        assert_eq!(foreign_write.status(), StatusCode::NOT_FOUND);

        let foreign_resolution = json_request(
            &app,
            Method::POST,
            &format!("/api/v1/workspaces/{workspace_id}/resolve"),
            Some(&other_cookie),
            Some(json!({ "revision": 1, "content": "overwrite attempt" })),
        )
        .await;
        assert_eq!(foreign_resolution.status(), StatusCode::NOT_FOUND);

        let owner_read = json_request(
            &app,
            Method::GET,
            &format!("/api/v1/workspaces/{workspace_id}"),
            Some(&owner_cookie),
            None,
        )
        .await;
        assert_eq!(response_json(owner_read).await["content"], "private draft");
    }

    /// Reject out-of-budget identifiers and content without persisting a partial workspace.
    #[tokio::test]
    async fn rejects_invalid_workspace_scope_and_oversized_content() {
        let app = test_app().await;
        let cookie = session_cookie(&app, "learner-a").await;
        let invalid_scope = json_request(
            &app,
            Method::POST,
            "/api/v1/workspaces",
            Some(&cookie),
            Some(json!({
                "lesson_id": " ",
                "item_id": "main.rs",
                "template_version": "starter-v1",
                "content": "starter"
            })),
        )
        .await;
        assert_eq!(invalid_scope.status(), StatusCode::BAD_REQUEST);

        let oversized = json_request(
            &app,
            Method::POST,
            "/api/v1/workspaces",
            Some(&cookie),
            Some(json!({
                "lesson_id": "M01-L01",
                "item_id": "main.rs",
                "template_version": "starter-v1",
                "content": "x".repeat(64 * 1024 + 1)
            })),
        )
        .await;
        assert_eq!(oversized.status(), StatusCode::BAD_REQUEST);
    }
}
