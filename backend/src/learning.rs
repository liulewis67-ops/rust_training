//! Owner-scoped learning state, idempotent updates, and account-time-zone study days.

use std::str::FromStr;

use axum::{
    Extension, Json, Router,
    extract::DefaultBodyLimit,
    http::StatusCode,
    response::{IntoResponse, Response},
    routing::{get, post, put},
};
use jiff::{Timestamp, civil::Date, tz::TimeZone};
use serde::{Deserialize, Serialize};
use sqlx::{Row, SqlitePool, sqlite::SqliteConnectOptions, sqlite::SqlitePoolOptions};
use time::OffsetDateTime;
use tower_sessions::Session;

const USER_KEY: &str = "user_id";
const MAX_REQUEST_BYTES: usize = 128 * 1024;
const MAX_LESSONS: usize = 500;
const MAX_REFLECTIONS: usize = 200;
const MAX_SELF_ASSESSMENTS: usize = 2_000;
const MAX_REFLECTION_BYTES: usize = 16 * 1024;
const MAX_STUDY_DAYS: i64 = 366;

/// SQLite persistence for cross-device learning data and idempotent update events.
#[derive(Clone, Debug)]
pub struct LearningStore {
    pool: SqlitePool,
}

impl LearningStore {
    /// Connect to the shared SQLite database and apply the additive learning migration.
    ///
    /// # Errors
    /// Returns a SQLx error when the database cannot be opened or migrated.
    pub async fn connect(database_url: &str) -> Result<Self, sqlx::Error> {
        let options = SqliteConnectOptions::from_str(database_url)?.create_if_missing(true);
        let pool = SqlitePoolOptions::new()
            .max_connections(1)
            .connect_with(options)
            .await?;
        sqlx::raw_sql(include_str!("../migrations/0003_learning.sql"))
            .execute(&pool)
            .await?;
        if !has_assessment_source_column(&pool).await? {
            sqlx::raw_sql(include_str!("../migrations/0004_learning_provenance.sql"))
                .execute(&pool)
                .await?;
        }
        if !has_study_activity_column(&pool).await? {
            sqlx::raw_sql(include_str!(
                "../migrations/0005_learning_event_activity.sql"
            ))
            .execute(&pool)
            .await?;
        }
        Ok(Self { pool })
    }

    /// Merge one snapshot into owner-scoped records and record its idempotency event.
    ///
    /// # Errors
    /// Returns a SQLx error if the transaction or any persistence operation fails.
    async fn sync(
        &self,
        owner_id: &str,
        request: &SyncLearningRequest,
    ) -> Result<LearningSnapshot, sqlx::Error> {
        let event_time = Timestamp::from_str(&request.occurred_at)
            .map_err(|error| sqlx::Error::Protocol(error.to_string()))?;
        let event_time = event_time.to_string();
        let position_time = Timestamp::from_str(&request.current_position_at)
            .map_err(|error| sqlx::Error::Protocol(error.to_string()))?
            .to_string();
        let now = OffsetDateTime::now_utc().unix_timestamp();
        let mut transaction = self.pool.begin().await?;

        // The first accepted snapshot fixes the account zone; later devices cannot silently change it.
        sqlx::query(
            "INSERT INTO learning_profiles (owner_id, time_zone, current_lesson, current_position_at, revision, updated_at) \
             VALUES (?, ?, ?, ?, 1, ?) ON CONFLICT (owner_id) DO NOTHING",
        )
        .bind(owner_id)
        .bind(&request.time_zone)
        .bind(&request.current_lesson)
        .bind(&position_time)
        .bind(now)
        .execute(&mut *transaction)
        .await?;
        let profile = sqlx::query(
            "SELECT time_zone, current_position_at FROM learning_profiles WHERE owner_id = ?",
        )
        .bind(owner_id)
        .fetch_one(&mut *transaction)
        .await?;
        let time_zone: String = profile.try_get("time_zone")?;
        let current_position_at: String = profile.try_get("current_position_at")?;
        let study_date = study_date(&event_time, &time_zone).map_err(sqlx::Error::Protocol)?;

        let event_id = &request.event_id;
        let inserted = sqlx::query(
            "INSERT INTO learning_events (owner_id, event_id, study_date, occurred_at, is_study_activity, created_at) VALUES (?, ?, ?, ?, ?, ?) \
             ON CONFLICT (owner_id, event_id) DO NOTHING",
        )
        .bind(owner_id)
        .bind(event_id)
        .bind(&study_date)
        .bind(&event_time)
        .bind(request.record_activity)
        .bind(now)
        .execute(&mut *transaction)
        .await?;
        if inserted.rows_affected() == 0 {
            transaction.commit().await?;
            return self.get(owner_id).await?.ok_or(sqlx::Error::RowNotFound);
        }

        if request.record_activity {
            sqlx::query(
                "INSERT INTO learning_study_days (owner_id, study_date) VALUES (?, ?) ON CONFLICT DO NOTHING",
            )
            .bind(owner_id)
            .bind(&study_date)
            .execute(&mut *transaction)
            .await?;
        }

        if position_time >= current_position_at {
            sqlx::query(
                "UPDATE learning_profiles SET current_lesson = ?, current_position_at = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ?",
            )
            .bind(&request.current_lesson)
            .bind(&position_time)
            .bind(now)
            .bind(owner_id)
            .execute(&mut *transaction)
            .await?;
        } else {
            sqlx::query(
                "UPDATE learning_profiles SET revision = revision + 1, updated_at = ? WHERE owner_id = ?",
            )
            .bind(now)
            .bind(owner_id)
            .execute(&mut *transaction)
            .await?;
        }

        for lesson_id in &request.completed {
            sqlx::query(
                "INSERT INTO learning_completed_lessons (owner_id, lesson_id, completed_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING",
            )
            .bind(owner_id)
            .bind(lesson_id)
            .bind(&event_time)
            .execute(&mut *transaction)
            .await?;
        }
        for reflection in &request.reflections {
            sqlx::query(
                "INSERT INTO learning_reflections (owner_id, lesson_id, content, updated_at) VALUES (?, ?, ?, ?) \
                 ON CONFLICT (owner_id, lesson_id) DO UPDATE SET content = excluded.content, updated_at = excluded.updated_at \
                 WHERE excluded.updated_at > learning_reflections.updated_at",
            )
            .bind(owner_id)
            .bind(&reflection.lesson_id)
            .bind(&reflection.content)
            .bind(&reflection.updated_at)
            .execute(&mut *transaction)
            .await?;
        }
        for assessment in &request.self_assessments {
            sqlx::query(
                "INSERT INTO learning_self_assessments (owner_id, lesson_id, exercise_id, score, source, updated_at) VALUES (?, ?, ?, ?, ?, ?) \
                 ON CONFLICT (owner_id, lesson_id, exercise_id) DO UPDATE SET score = excluded.score, source = excluded.source, updated_at = excluded.updated_at \
                 WHERE excluded.updated_at > learning_self_assessments.updated_at",
            )
            .bind(owner_id)
            .bind(&assessment.lesson_id)
            .bind(&assessment.exercise_id)
            .bind(assessment.score)
            .bind(assessment.source.as_str())
            .bind(&assessment.updated_at)
            .execute(&mut *transaction)
            .await?;
        }
        transaction.commit().await?;
        self.get(owner_id).await?.ok_or(sqlx::Error::RowNotFound)
    }

    /// Read one complete learning snapshot only for the authenticated owner.
    ///
    /// # Errors
    /// Returns a SQLx error when a query or stored row decoding fails.
    async fn get(&self, owner_id: &str) -> Result<Option<LearningSnapshot>, sqlx::Error> {
        let profile = sqlx::query(
            "SELECT time_zone, current_lesson, current_position_at, revision FROM learning_profiles WHERE owner_id = ?",
        )
        .bind(owner_id)
        .fetch_optional(&self.pool)
        .await?;
        let Some(profile) = profile else {
            return Ok(None);
        };
        let time_zone: String = profile.try_get("time_zone")?;
        let completed = sqlx::query(
            "SELECT lesson_id, completed_at FROM learning_completed_lessons WHERE owner_id = ? ORDER BY completed_at, lesson_id",
        )
        .bind(owner_id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|row| {
            // Return one completion DTO rather than exposing the stored row.
            Ok(CompletedLesson {
                lesson_id: row.try_get("lesson_id")?,
                completed_at: row.try_get("completed_at")?,
            })
        })
        .collect::<Result<Vec<_>, sqlx::Error>>()?;
        let reflections = sqlx::query(
            "SELECT lesson_id, content, updated_at FROM learning_reflections WHERE owner_id = ? ORDER BY lesson_id",
        )
        .bind(owner_id)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|row| {
            // Include the edit instant so devices can merge concurrent reflections.
            Ok(LearningReflection {
                lesson_id: row.try_get("lesson_id")?,
                content: row.try_get("content")?,
                updated_at: row.try_get("updated_at")?,
            })
        })
        .collect::<Result<Vec<_>, sqlx::Error>>()?;
        let self_assessments = sqlx::query(
            "SELECT lesson_id, exercise_id, score, source, updated_at FROM learning_self_assessments WHERE owner_id = ? ORDER BY updated_at DESC LIMIT ?",
        )
        .bind(owner_id)
        .bind(MAX_SELF_ASSESSMENTS as i64)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|row| {
            // Keep personal self-ratings distinct from objective answer results.
            let source: String = row.try_get("source")?;
            Ok(SelfAssessment {
                lesson_id: row.try_get("lesson_id")?,
                exercise_id: row.try_get("exercise_id")?,
                score: row.try_get("score")?,
                source: SelfAssessmentSource::parse(&source).map_err(sqlx::Error::Protocol)?,
                updated_at: row.try_get("updated_at")?,
            })
        })
        .collect::<Result<Vec<_>, sqlx::Error>>()?;
        let study_days = sqlx::query(
            "SELECT study_date FROM learning_study_days WHERE owner_id = ? ORDER BY study_date DESC LIMIT ?",
        )
        .bind(owner_id)
        .bind(MAX_STUDY_DAYS)
        .fetch_all(&self.pool)
        .await?
        .into_iter()
        .map(|row| {
            // Preserve stable reverse-chronological calendar ordering.
            row.try_get("study_date")
        })
        .collect::<Result<Vec<String>, sqlx::Error>>()?;
        let streak = active_streak(&study_days);
        Ok(Some(LearningSnapshot {
            time_zone,
            current_lesson: profile.try_get("current_lesson")?,
            current_position_at: profile.try_get("current_position_at")?,
            revision: profile.try_get("revision")?,
            completed,
            reflections,
            self_assessments,
            study_days,
            streak,
        }))
    }

    /// Change the account's time zone used for subsequent study-day calculations.
    ///
    /// # Errors
    /// Returns a SQLx error if the account profile cannot be updated.
    async fn set_time_zone(&self, owner_id: &str, time_zone: &str) -> Result<(), sqlx::Error> {
        let now = Timestamp::now().to_string();
        let mut transaction = self.pool.begin().await?;
        sqlx::query(
            "INSERT INTO learning_profiles (owner_id, time_zone, current_lesson, current_position_at, revision, updated_at) \
             VALUES (?, ?, 'ownership', ?, 1, ?) \
             ON CONFLICT (owner_id) DO UPDATE SET time_zone = excluded.time_zone, revision = learning_profiles.revision + 1, updated_at = excluded.updated_at",
        )
        .bind(owner_id)
        .bind(time_zone)
        .bind(now)
        .bind(OffsetDateTime::now_utc().unix_timestamp())
        .execute(&mut *transaction)
        .await?;
        // Rebuild all recorded days so historical learning dates follow the new account zone.
        sqlx::query("DELETE FROM learning_study_days WHERE owner_id = ?")
            .bind(owner_id)
            .execute(&mut *transaction)
            .await?;
        let events =
            sqlx::query("SELECT event_id, occurred_at, is_study_activity FROM learning_events WHERE owner_id = ?")
                .bind(owner_id)
                .fetch_all(&mut *transaction)
                .await?;
        for event in events {
            let event_id: String = event.try_get("event_id")?;
            let occurred_at: String = event.try_get("occurred_at")?;
            let is_study_activity: bool = event.try_get("is_study_activity")?;
            let date = study_date(&occurred_at, time_zone).map_err(sqlx::Error::Protocol)?;
            sqlx::query(
                "UPDATE learning_events SET study_date = ? WHERE owner_id = ? AND event_id = ?",
            )
            .bind(&date)
            .bind(owner_id)
            .bind(event_id)
            .execute(&mut *transaction)
            .await?;
            if is_study_activity {
                sqlx::query(
                    "INSERT INTO learning_study_days (owner_id, study_date) VALUES (?, ?) ON CONFLICT DO NOTHING",
                )
                .bind(owner_id)
                .bind(date)
                .execute(&mut *transaction)
                .await?;
            }
        }
        transaction.commit().await?;
        Ok(())
    }
}

/// Check whether the additive provenance migration has already been applied.
async fn has_assessment_source_column(pool: &SqlitePool) -> Result<bool, sqlx::Error> {
    let columns = sqlx::query("PRAGMA table_info(learning_self_assessments)")
        .fetch_all(pool)
        .await?;
    Ok(columns
        .iter()
        .any(|column| column.try_get::<String, _>("name").ok().as_deref() == Some("source")))
}

/// Check whether event rows distinguish learning activity from administrative imports.
async fn has_study_activity_column(pool: &SqlitePool) -> Result<bool, sqlx::Error> {
    let columns = sqlx::query("PRAGMA table_info(learning_events)")
        .fetch_all(pool)
        .await?;
    Ok(columns.iter().any(|column| {
        column.try_get::<String, _>("name").ok().as_deref() == Some("is_study_activity")
    }))
}

/// Mount session-authenticated learning state routes with a bounded request body.
pub fn router(store: LearningStore) -> Router {
    Router::new()
        .route("/api/v1/learning/state", get(get_state))
        .route("/api/v1/learning/sync", post(sync_state))
        .route("/api/v1/learning/time-zone", put(set_time_zone))
        .layer(DefaultBodyLimit::max(MAX_REQUEST_BYTES))
        .layer(Extension(store))
}

/// Return the caller's learning state or a consistent not-found response before first sync.
async fn get_state(Extension(store): Extension<LearningStore>, session: Session) -> Response {
    let owner_id = match session_owner(&session).await {
        Ok(owner_id) => owner_id,
        Err(response) => return response,
    };
    match store.get(&owner_id).await {
        Ok(Some(snapshot)) => Json(snapshot).into_response(),
        Ok(None) => api_error(
            StatusCode::NOT_FOUND,
            "learning_state_not_found",
            "Learning state has not been initialized.",
        ),
        Err(_) => storage_error(),
    }
}

/// Validate and merge an idempotent learning snapshot from one device.
async fn sync_state(
    Extension(store): Extension<LearningStore>,
    session: Session,
    Json(request): Json<SyncLearningRequest>,
) -> Response {
    let owner_id = match session_owner(&session).await {
        Ok(owner_id) => owner_id,
        Err(response) => return response,
    };
    if !valid_request(&request) {
        return api_error(
            StatusCode::BAD_REQUEST,
            "invalid_learning_snapshot",
            "Learning data or account time zone is invalid.",
        );
    }
    match store.sync(&owner_id, &request).await {
        Ok(snapshot) => Json(snapshot).into_response(),
        Err(_) => storage_error(),
    }
}

/// Update the caller's persistent IANA account time zone.
async fn set_time_zone(
    Extension(store): Extension<LearningStore>,
    session: Session,
    Json(request): Json<TimeZoneRequest>,
) -> Response {
    let owner_id = match session_owner(&session).await {
        Ok(owner_id) => owner_id,
        Err(response) => return response,
    };
    let Ok(time_zone) = TimeZone::get(&request.time_zone) else {
        return api_error(
            StatusCode::BAD_REQUEST,
            "invalid_time_zone",
            "Use a valid IANA time-zone identifier.",
        );
    };
    let Some(canonical_name) = time_zone.iana_name() else {
        return api_error(
            StatusCode::BAD_REQUEST,
            "invalid_time_zone",
            "Use a named IANA time zone.",
        );
    };
    match store.set_time_zone(&owner_id, canonical_name).await {
        Ok(()) => match store.get(&owner_id).await {
            Ok(Some(snapshot)) => Json(snapshot).into_response(),
            Ok(None) => storage_error(),
            Err(_) => storage_error(),
        },
        Err(_) => storage_error(),
    }
}

/// Resolve the authenticated owner exclusively from the server-managed session.
async fn session_owner(session: &Session) -> Result<String, Response> {
    match session.get::<String>(USER_KEY).await {
        Ok(Some(owner_id)) if !owner_id.trim().is_empty() => Ok(owner_id),
        Ok(_) => Err(api_error(
            StatusCode::UNAUTHORIZED,
            "authentication_required",
            "Sign in to sync learning progress.",
        )),
        Err(_) => Err(storage_error()),
    }
}

/// Validate bounded identifiers, timestamps, scores, and the supplied IANA time zone.
fn valid_request(request: &SyncLearningRequest) -> bool {
    let valid_zone = TimeZone::get(&request.time_zone)
        .ok()
        .and_then(|zone| zone.iana_name().map(str::to_owned))
        .is_some();
    valid_identifier(&request.event_id)
        && request.event_id.len() <= 128
        && valid_identifier(&request.current_lesson)
        && valid_timestamp(&request.current_position_at)
        && request.completed.len() <= MAX_LESSONS
        && request
            .completed
            .iter()
            .all(|lesson| valid_identifier(lesson))
        && request.reflections.len() <= MAX_REFLECTIONS
        && request.reflections.iter().all(|reflection| {
            valid_identifier(&reflection.lesson_id)
                && reflection.content.len() <= MAX_REFLECTION_BYTES
                && valid_timestamp(&reflection.updated_at)
        })
        && request.self_assessments.len() <= MAX_SELF_ASSESSMENTS
        && request.self_assessments.iter().all(|assessment| {
            valid_identifier(&assessment.lesson_id)
                && valid_identifier(&assessment.exercise_id)
                && (1..=5).contains(&assessment.score)
                && valid_timestamp(&assessment.updated_at)
        })
        && valid_timestamp(&request.occurred_at)
        && valid_zone
}

/// Validate one stable owner-scoped learning identifier.
fn valid_identifier(value: &str) -> bool {
    !value.trim().is_empty() && value.len() <= 128
}

/// Check whether a string is a parseable absolute timestamp.
fn valid_timestamp(value: &str) -> bool {
    Timestamp::from_str(value).is_ok()
}

/// Convert one event timestamp into the account's calendar day using IANA transition rules.
fn study_date(timestamp: &str, time_zone: &str) -> Result<String, String> {
    let timestamp = Timestamp::from_str(timestamp).map_err(|error| error.to_string())?;
    TimeZone::get(time_zone).map_err(|error| error.to_string())?;
    Ok(timestamp
        .in_tz(time_zone)
        .map_err(|error| error.to_string())?
        .date()
        .to_string())
}

/// Count consecutive persisted account-local dates from the most recent learning day.
fn active_streak(days_descending: &[String]) -> u32 {
    let Some(latest) = days_descending.first() else {
        return 0;
    };
    let Ok(mut expected) = Date::from_str(latest) else {
        return 0;
    };
    let mut streak = 0;
    for value in days_descending {
        if value != &expected.to_string() {
            break;
        }
        streak += 1;
        let Ok(previous) = expected.yesterday() else {
            break;
        };
        expected = previous;
    }
    streak
}

/// Return a stable error envelope without exposing SQLite details or local paths.
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

/// Hide account data existence from anonymous or cross-owner requests.
fn storage_error() -> Response {
    api_error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "learning_storage_failed",
        "Learning progress is temporarily unavailable.",
    )
}

/// Request body for an idempotent per-device snapshot synchronization.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct SyncLearningRequest {
    event_id: String,
    #[serde(default = "default_record_activity")]
    record_activity: bool,
    occurred_at: String,
    current_position_at: String,
    time_zone: String,
    current_lesson: String,
    completed: Vec<String>,
    reflections: Vec<LearningReflection>,
    self_assessments: Vec<SelfAssessment>,
}

/// Treat old clients that omit activity intent as real learning interactions.
fn default_record_activity() -> bool {
    true
}

/// Account time-zone change request.
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct TimeZoneRequest {
    time_zone: String,
}

/// One saved reflection with its last edit instant.
#[derive(Clone, Deserialize, Serialize)]
struct LearningReflection {
    lesson_id: String,
    content: String,
    updated_at: String,
}

/// One self-reported score, kept separate from correctness and official grades.
#[derive(Clone, Deserialize, Serialize)]
struct SelfAssessment {
    lesson_id: String,
    exercise_id: String,
    score: i64,
    #[serde(default)]
    source: SelfAssessmentSource,
    updated_at: String,
}

/// Provenance preserved for learner-entered and imported historical scores.
#[derive(Clone, Copy, Default, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
enum SelfAssessmentSource {
    #[default]
    LearnerReported,
    LegacySelfReported,
}

impl SelfAssessmentSource {
    /// Return the stable API and database spelling for this evidence source.
    fn as_str(self) -> &'static str {
        match self {
            Self::LearnerReported => "learner_reported",
            Self::LegacySelfReported => "legacy_self_reported",
        }
    }

    /// Parse the checked database representation into its closed provenance type.
    fn parse(value: &str) -> Result<Self, String> {
        match value {
            "learner_reported" => Ok(Self::LearnerReported),
            "legacy_self_reported" => Ok(Self::LegacySelfReported),
            _ => Err("stored self-assessment source is invalid".to_owned()),
        }
    }
}

/// One course completion with the first recorded completion instant.
#[derive(Serialize)]
struct CompletedLesson {
    lesson_id: String,
    completed_at: String,
}

/// Complete account-owned state returned to a device.
#[derive(Serialize)]
struct LearningSnapshot {
    time_zone: String,
    current_lesson: String,
    current_position_at: String,
    revision: i64,
    completed: Vec<CompletedLesson>,
    reflections: Vec<LearningReflection>,
    self_assessments: Vec<SelfAssessment>,
    study_days: Vec<String>,
    streak: u32,
}

/// Stable public error payload used by authenticated learning routes.
#[derive(Serialize)]
struct ApiError {
    code: &'static str,
    message: &'static str,
    retryable: bool,
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

    use super::{LearningStore, active_streak, router};
    use crate::sessions::SqliteSessionStore;

    /// Seed an authenticated owner for API tests without an external OIDC server.
    async fn seed_identity(
        axum::extract::Path(owner_id): axum::extract::Path<String>,
        session: Session,
    ) -> StatusCode {
        session
            .insert("user_id", owner_id)
            .await
            .expect("SQLite session test identity should be writable");
        StatusCode::NO_CONTENT
    }

    /// Build the real learning routes and SQLite session middleware over memory databases.
    async fn test_app() -> Router {
        let store = LearningStore::connect("sqlite::memory:")
            .await
            .expect("learning migration should apply");
        let sessions = SqliteSessionStore::connect("sqlite::memory:")
            .await
            .expect("session schema should initialize");
        Router::new()
            .route("/test/session/{owner_id}", get(seed_identity))
            .merge(router(store))
            .layer(SessionManagerLayer::new(sessions).with_secure(false))
    }

    /// Create one session cookie for a simulated browser belonging to an owner.
    async fn session_cookie(app: &Router, owner_id: &str) -> String {
        let response = app
            .clone()
            .oneshot(
                HttpRequest::builder()
                    .uri(format!("/test/session/{owner_id}"))
                    .body(Body::empty())
                    .expect("session seed request should be valid"),
            )
            .await
            .expect("session route should respond");
        response
            .headers()
            .get(header::SET_COOKIE)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(';').next())
            .expect("session route should set a cookie")
            .to_owned()
    }

    /// Send a JSON request with one optional test account cookie.
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
                    .expect("learning request should be valid"),
            )
            .await
            .expect("learning route should respond")
    }

    /// Decode a bounded learning response for field-level assertions.
    async fn response_json(response: axum::response::Response) -> Value {
        let bytes = to_bytes(response.into_body(), 160 * 1024)
            .await
            .expect("learning response should fit its limit");
        serde_json::from_slice(&bytes).expect("learning response should be JSON")
    }

    /// Duplicate event IDs do not add days twice, and snapshots preserve self-ratings separately.
    #[tokio::test]
    async fn sync_is_idempotent_and_keeps_self_assessment_non_authoritative() {
        let app = test_app().await;
        let cookie = session_cookie(&app, "learner-a").await;
        let payload = json!({
            "event_id": "device-a-event-1",
            "occurred_at": "2026-03-09T04:30:00Z",
            "current_position_at": "2026-03-09T04:30:00Z",
            "time_zone": "America/Los_Angeles",
            "current_lesson": "borrowing",
            "completed": ["ownership"],
            "reflections": [{
                "lesson_id": "ownership",
                "content": "I understand moves now.",
                "updated_at": "2026-03-09T04:30:00Z"
            }],
            "self_assessments": [{
                "lesson_id": "ownership",
                "exercise_id": "open-1",
                "score": 5,
                "source": "legacy_self_reported",
                "updated_at": "2026-03-09T04:30:00Z"
            }]
        });
        let first = json_request(
            &app,
            Method::POST,
            "/api/v1/learning/sync",
            Some(&cookie),
            Some(payload.clone()),
        )
        .await;
        assert_eq!(first.status(), StatusCode::OK);
        let first = response_json(first).await;
        assert_eq!(first["study_days"], json!(["2026-03-08"]));
        assert_eq!(first["streak"], 1);
        assert_eq!(first["self_assessments"][0]["score"], 5);
        assert_eq!(
            first["self_assessments"][0]["source"],
            "legacy_self_reported"
        );
        assert_eq!(first["completed"][0]["lesson_id"], "ownership");

        let duplicate = json_request(
            &app,
            Method::POST,
            "/api/v1/learning/sync",
            Some(&cookie),
            Some(payload),
        )
        .await;
        let duplicate = response_json(duplicate).await;
        assert_eq!(duplicate["study_days"], json!(["2026-03-08"]));
        assert_eq!(duplicate["revision"], first["revision"]);

        let next_device_event = json_request(
            &app,
            Method::POST,
            "/api/v1/learning/sync",
            Some(&cookie),
            Some(json!({
                "event_id": "device-b-event-1",
                "occurred_at": "2026-03-09T04:30:00Z",
                "current_position_at": "2026-03-09T04:30:00Z",
                "time_zone": "Asia/Shanghai",
                "current_lesson": "borrowing",
                "completed": ["ownership"],
                "reflections": [],
                "self_assessments": []
            })),
        )
        .await;
        let next_device_event = response_json(next_device_event).await;
        assert_eq!(next_device_event["time_zone"], "America/Los_Angeles");
        assert_eq!(next_device_event["study_days"], json!(["2026-03-08"]));

        let changed_zone = json_request(
            &app,
            Method::PUT,
            "/api/v1/learning/time-zone",
            Some(&cookie),
            Some(json!({ "time_zone": "Asia/Shanghai" })),
        )
        .await;
        let changed_zone = response_json(changed_zone).await;
        assert_eq!(changed_zone["time_zone"], "Asia/Shanghai");
        assert_eq!(changed_zone["study_days"], json!(["2026-03-09"]));
    }

    /// A different device restores the latest account state, while another owner sees no data.
    #[tokio::test]
    async fn restores_owner_state_and_rejects_cross_owner_reads() {
        let app = test_app().await;
        let owner = session_cookie(&app, "learner-a").await;
        let device_two = session_cookie(&app, "learner-a").await;
        let other_owner = session_cookie(&app, "learner-b").await;
        let payload = json!({
            "event_id": "device-a-event-2",
            "occurred_at": "2026-03-10T12:00:00Z",
            "current_position_at": "2026-03-10T12:00:00Z",
            "time_zone": "Asia/Shanghai",
            "current_lesson": "borrowing",
            "completed": ["ownership"],
            "reflections": [],
            "self_assessments": []
        });
        let saved = json_request(
            &app,
            Method::POST,
            "/api/v1/learning/sync",
            Some(&owner),
            Some(payload),
        )
        .await;
        assert_eq!(saved.status(), StatusCode::OK);

        let restored = json_request(
            &app,
            Method::GET,
            "/api/v1/learning/state",
            Some(&device_two),
            None,
        )
        .await;
        assert_eq!(response_json(restored).await["current_lesson"], "borrowing");

        let foreign_read = json_request(
            &app,
            Method::GET,
            "/api/v1/learning/state",
            Some(&other_owner),
            None,
        )
        .await;
        assert_eq!(foreign_read.status(), StatusCode::NOT_FOUND);
    }

    /// Administrative imports persist records without manufacturing a study day.
    #[tokio::test]
    async fn non_activity_sync_does_not_add_a_study_day() {
        let app = test_app().await;
        let cookie = session_cookie(&app, "learner-a").await;
        let response = json_request(
            &app,
            Method::POST,
            "/api/v1/learning/sync",
            Some(&cookie),
            Some(json!({
                "event_id": "legacy-import-1",
                "record_activity": false,
                "occurred_at": "2026-10-12T12:00:00Z",
                "current_position_at": "2026-10-12T12:00:00Z",
                "time_zone": "Asia/Shanghai",
                "current_lesson": "ownership",
                "completed": ["ownership"],
                "reflections": [],
                "self_assessments": [{
                    "lesson_id": "ownership",
                    "exercise_id": "old-open-question",
                    "score": 5,
                    "source": "legacy_self_reported",
                    "updated_at": "2024-04-05T10:00:00Z"
                }]
            })),
        )
        .await;
        let snapshot = response_json(response).await;
        assert_eq!(snapshot["completed"][0]["lesson_id"], "ownership");
        assert_eq!(
            snapshot["self_assessments"][0]["source"],
            "legacy_self_reported"
        );
        assert_eq!(snapshot["study_days"], json!([]));
    }

    /// Calculate streaks only across consecutive calendar dates, including leap-day boundaries.
    #[test]
    fn streak_stops_at_calendar_gaps_and_handles_leap_days() {
        assert_eq!(
            active_streak(&[
                "2024-03-01".into(),
                "2024-02-29".into(),
                "2024-02-28".into(),
                "2024-02-26".into(),
            ]),
            3
        );
        assert_eq!(
            active_streak(&["2024-03-01".into(), "2024-02-28".into()]),
            1
        );
    }

    /// Reject an unknown account time zone and malformed self-rating without persisting state.
    #[tokio::test]
    async fn rejects_invalid_time_zone_and_out_of_range_self_assessment() {
        let app = test_app().await;
        let cookie = session_cookie(&app, "learner-a").await;
        let response = json_request(
            &app,
            Method::POST,
            "/api/v1/learning/sync",
            Some(&cookie),
            Some(json!({
                "event_id": "bad-zone",
                "occurred_at": "2026-03-10T12:00:00Z",
                "current_position_at": "2026-03-10T12:00:00Z",
                "time_zone": "Not/AZone",
                "current_lesson": "ownership",
                "completed": [],
                "reflections": [],
                "self_assessments": []
            })),
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);

        let response = json_request(
            &app,
            Method::POST,
            "/api/v1/learning/sync",
            Some(&cookie),
            Some(json!({
                "event_id": "bad-score",
                "occurred_at": "2026-03-10T12:00:00Z",
                "current_position_at": "2026-03-10T12:00:00Z",
                "time_zone": "UTC",
                "current_lesson": "ownership",
                "completed": [],
                "reflections": [],
                "self_assessments": [{
                    "lesson_id": "ownership",
                    "exercise_id": "open-1",
                    "score": 6,
                    "source": "learner_reported",
                    "updated_at": "2026-03-10T12:00:00Z"
                }]
            })),
        )
        .await;
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }
}
