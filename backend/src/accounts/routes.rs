//! 本地账号注册、邮箱验证与恢复接口。

use std::{net::SocketAddr, sync::Arc};

use axum::{
    Json, Router,
    extract::{ConnectInfo, State},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
    routing::post,
};
use lettre::message::Mailbox;
use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use tower_sessions::Session;

use super::{
    mailer::{ActionEmail, Mailer},
    normalize_email,
    rate_limit::{RateLimitDecision, RateLimitRequest, consume_limits},
    security::{digest_action_token, hash_password, new_action_token, validate_password},
    store::{AccountStore, AccountStoreError},
};

const VERIFY_EMAIL: &str = "verify_email";
const VERIFY_TTL_SECONDS: i64 = 24 * 60 * 60;
const RESET_TTL_SECONDS: i64 = 30 * 60;
const PUBLIC_MESSAGE: &str = "如果该邮箱需要操作，请检查收件箱。";
const USER_KEY: &str = "user_id";
const EMAIL_KEY: &str = "account_email";

#[derive(Clone)]
pub(super) struct AccountState {
    store: AccountStore,
    mailer: Arc<dyn Mailer>,
    app_origin: String,
}

/// 组装本地账号 HTTP 路由及其持久化、邮件状态。
pub(crate) fn router(store: AccountStore, mailer: Arc<dyn Mailer>, app_origin: String) -> Router {
    let state = AccountState {
        store,
        mailer,
        app_origin,
    };
    Router::new()
        .route("/api/v1/auth/register", post(register))
        .route("/api/v1/auth/login", post(login))
        .route("/api/v1/auth/forgot-password", post(forgot_password))
        .route("/api/v1/auth/reset-password", post(reset_password))
        .route("/api/v1/auth/verify-email", post(verify_email))
        .route(
            "/api/v1/auth/resend-verification",
            post(resend_verification),
        )
        .with_state(state)
}

#[derive(Serialize)]
struct SessionResponse {
    user_id: String,
    email: String,
}

/// 返回当前本地账号的邮箱和内部 UUID，匿名请求返回 401。
pub(crate) async fn session_info(session: Session) -> Response {
    match (
        session.get::<String>(USER_KEY).await,
        session.get::<String>(EMAIL_KEY).await,
    ) {
        (Ok(Some(user_id)), Ok(Some(email))) => {
            Json(SessionResponse { user_id, email }).into_response()
        }
        (Ok(Some(_)), Ok(None)) => super::super::identity::session_info(session).await,
        (Ok(None), _) => StatusCode::UNAUTHORIZED.into_response(),
        _ => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

/// 删除当前服务端 session 以完成退出。
pub(crate) async fn logout(session: Session) -> Response {
    match session.delete().await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(_) => internal_error(),
    }
}

/// 校验邮箱密码并建立绑定内部账号 UUID 的新 session。
async fn login(
    State(state): State<AccountState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    session: Session,
    Json(request): Json<LoginRequest>,
) -> Response {
    let email = match normalize_email(&request.email) {
        Ok(email) => email,
        Err(_) => return invalid_credentials(),
    };
    let now = OffsetDateTime::now_utc().unix_timestamp();
    let limits = [
        limit(
            "login_ip_email",
            format!("{}:{}", peer.ip(), email.normalized),
            10,
            900,
        ),
        limit("login_email", email.normalized.clone(), 10, 900),
    ];
    if let Some(response) = apply_limits(&state.store, &limits, now).await {
        return response;
    }
    let account = match state.store.find_by_email(&email.normalized).await {
        Ok(account) => account,
        Err(_) => return internal_error(),
    };
    let Some(account) = account else {
        let _ = hash_password(request.password).await;
        return invalid_credentials();
    };
    if !matches!(
        super::security::verify_password(request.password, account.password_hash).await,
        Ok(true)
    ) {
        return invalid_credentials();
    }
    if account.email_verified_at.is_none() {
        return error_response(
            StatusCode::FORBIDDEN,
            "email_verification_required",
            "请先验证邮箱，再登录。",
            false,
        );
    }
    if session.cycle_id().await.is_err()
        || session.insert(USER_KEY, &account.id).await.is_err()
        || session
            .insert(EMAIL_KEY, &account.email_display)
            .await
            .is_err()
    {
        return internal_error();
    }
    Json(LoginResponse {
        user_id: account.id,
        email: account.email_display,
    })
    .into_response()
}

/// 为已验证账号发出密码重置链接，并统一返回防枚举响应。
async fn forgot_password(
    State(state): State<AccountState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(request): Json<EmailRequest>,
) -> Response {
    let email = match normalize_email(&request.email) {
        Ok(email) => email,
        Err(_) => return public_accepted(),
    };
    let now = OffsetDateTime::now_utc().unix_timestamp();
    if let Some(response) = apply_limits(
        &state.store,
        &[limit("recovery_ip", peer.ip().to_string(), 10, 3600)],
        now,
    )
    .await
    {
        return response;
    }
    if !email_send_allowed(&state.store, &email.normalized, now).await {
        return public_accepted();
    }
    if let Ok(Some((account_id, display))) =
        state.store.find_verified_by_email(&email.normalized).await
    {
        let _ = send_reset(&state, &account_id, &display, now).await;
    }
    public_accepted()
}

/// 校验一次性重置令牌、更新密码并撤销账号现有 session。
async fn reset_password(
    State(state): State<AccountState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(request): Json<ResetRequest>,
) -> Response {
    if validate_password(&request.new_password).is_err() {
        return error_response(
            StatusCode::BAD_REQUEST,
            "invalid_password",
            "密码长度需为 12 至 128 个字符。",
            false,
        );
    }
    let digest = match digest_action_token(&request.token) {
        Ok(digest) => digest,
        Err(_) => {
            return error_response(
                StatusCode::BAD_REQUEST,
                "invalid_token",
                "重置链接无效或已过期。",
                false,
            );
        }
    };
    let now = OffsetDateTime::now_utc().unix_timestamp();
    let limits = [
        limit("reset_ip", peer.ip().to_string(), 10, 3600),
        limit("reset_token", digest.clone(), 5, 3600),
    ];
    if let Some(response) = apply_limits(&state.store, &limits, now).await {
        return response;
    }
    let password_hash = match hash_password(request.new_password).await {
        Ok(hash) => hash,
        Err(_) => return internal_error(),
    };
    match state
        .store
        .reset_password(&digest, &password_hash, now)
        .await
    {
        Ok(Some(_)) => StatusCode::NO_CONTENT.into_response(),
        Ok(None) => error_response(
            StatusCode::BAD_REQUEST,
            "invalid_token",
            "重置链接无效或已过期。",
            false,
        ),
        Err(_) => internal_error(),
    }
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct RegisterRequest {
    email: String,
    password: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct EmailRequest {
    email: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct VerifyRequest {
    token: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct LoginRequest {
    email: String,
    password: String,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct ResetRequest {
    token: String,
    new_password: String,
}

#[derive(Serialize)]
struct PublicMessageResponse {
    message: &'static str,
}

#[derive(Serialize)]
struct ApiError {
    code: &'static str,
    message: &'static str,
    request_id: String,
    retryable: bool,
}

#[derive(Serialize)]
struct LoginResponse {
    user_id: String,
    email: String,
}

/// 创建未验证账号，并在事务提交后发送邮箱验证链接。
async fn register(
    State(state): State<AccountState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(request): Json<RegisterRequest>,
) -> Response {
    if validate_password(&request.password).is_err() {
        return error_response(
            StatusCode::BAD_REQUEST,
            "invalid_password",
            "密码长度需为 12 至 128 个字符。",
            false,
        );
    }
    let email = match normalize_email(&request.email) {
        Ok(email) => email,
        Err(_) => {
            return error_response(
                StatusCode::BAD_REQUEST,
                "invalid_email",
                "请输入有效邮箱地址。",
                false,
            );
        }
    };
    let now = OffsetDateTime::now_utc().unix_timestamp();
    if let Some(response) = apply_limits(
        &state.store,
        &[limit("register_ip", peer.ip().to_string(), 5, 3600)],
        now,
    )
    .await
    {
        return response;
    }
    if !email_send_allowed(&state.store, &email.normalized, now).await {
        return public_accepted();
    }

    let existing = match state.store.find_by_email(&email.normalized).await {
        Ok(existing) => existing,
        Err(_) => return internal_error(),
    };
    if let Some(account) = existing {
        if account.email_verified_at.is_none() {
            let _ = send_verification(&state, &account.id, &email.display, now).await;
        }
        return public_accepted();
    }

    let password_hash = match hash_password(request.password).await {
        Ok(hash) => hash,
        Err(_) => return internal_error(),
    };
    let (token, token_hash) = match new_action_token() {
        Ok(token) => token,
        Err(_) => return internal_error(),
    };
    match state
        .store
        .create_unverified_with_token(
            &email.normalized,
            &email.display,
            &password_hash,
            &token_hash,
            now.saturating_add(VERIFY_TTL_SECONDS),
            now,
        )
        .await
    {
        Ok(_) => {}
        Err(AccountStoreError::EmailAlreadyExists) => return public_accepted(),
        Err(AccountStoreError::Unavailable) => return internal_error(),
    }
    deliver_verification(&state, &email.display, &token).await;
    public_accepted()
}

/// 为未验证账号替换验证令牌，对所有邮箱返回相同结果。
async fn resend_verification(
    State(state): State<AccountState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(request): Json<EmailRequest>,
) -> Response {
    let email = match normalize_email(&request.email) {
        Ok(email) => email,
        Err(_) => return public_accepted(),
    };
    let now = OffsetDateTime::now_utc().unix_timestamp();
    if let Some(response) = apply_limits(
        &state.store,
        &[limit("verify_ip", peer.ip().to_string(), 10, 3600)],
        now,
    )
    .await
    {
        return response;
    }
    if !email_send_allowed(&state.store, &email.normalized, now).await {
        return public_accepted();
    }
    if let Ok(Some(account)) = state.store.find_by_email(&email.normalized).await {
        if account.email_verified_at.is_none() {
            let _ = send_verification(&state, &account.id, &email.display, now).await;
        }
    }
    public_accepted()
}

/// 消耗一次性令牌并验证所属邮箱。
async fn verify_email(
    State(state): State<AccountState>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    Json(request): Json<VerifyRequest>,
) -> Response {
    let digest = match digest_action_token(&request.token) {
        Ok(digest) => digest,
        Err(_) => {
            return error_response(
                StatusCode::BAD_REQUEST,
                "invalid_token",
                "验证链接无效或已过期。",
                false,
            );
        }
    };
    let now = OffsetDateTime::now_utc().unix_timestamp();
    let limits = [
        limit("verify_ip", peer.ip().to_string(), 10, 3600),
        limit("verify_token", digest.clone(), 5, 3600),
    ];
    if let Some(response) = apply_limits(&state.store, &limits, now).await {
        return response;
    }
    match state.store.consume_verification_token(&digest, now).await {
        Ok(Some(_)) => StatusCode::NO_CONTENT.into_response(),
        Ok(None) => error_response(
            StatusCode::BAD_REQUEST,
            "invalid_token",
            "验证链接无效或已过期。",
            false,
        ),
        Err(_) => internal_error(),
    }
}

/// 替换账号待处理的验证令牌并发送新链接。
async fn send_verification(
    state: &AccountState,
    account_id: &str,
    recipient: &str,
    now: i64,
) -> Result<(), AccountStoreError> {
    let (token, digest) = new_action_token().map_err(|_| AccountStoreError::Unavailable)?;
    state
        .store
        .replace_action_token(
            account_id,
            VERIFY_EMAIL,
            &digest,
            now.saturating_add(VERIFY_TTL_SECONDS),
            now,
        )
        .await?;
    deliver_verification(state, recipient, &token).await;
    Ok(())
}

/// 通过已配置邮件适配器投递邮箱验证链接。
async fn deliver_verification(state: &AccountState, recipient: &str, token: &str) {
    let mailbox = recipient.parse::<Mailbox>();
    let Ok(mailbox) = mailbox else {
        eprintln!("Account verification email delivery failed.");
        return;
    };
    let link = format!(
        "{}/verify-email?token={token}",
        state.app_origin.trim_end_matches('/')
    );
    if state
        .mailer
        .send_action(ActionEmail {
            recipient: mailbox,
            subject: "验证你的 Rust Path 邮箱".to_owned(),
            body: format!("请在 24 小时内打开以下链接验证邮箱：\n\n{link}\n"),
        })
        .await
        .is_err()
    {
        eprintln!("Account verification email delivery failed.");
    }
}

/// 持久化一次性重置令牌摘要并发送密码恢复邮件。
async fn send_reset(
    state: &AccountState,
    account_id: &str,
    recipient: &str,
    now: i64,
) -> Result<(), AccountStoreError> {
    let (token, digest) = new_action_token().map_err(|_| AccountStoreError::Unavailable)?;
    state
        .store
        .replace_action_token(
            account_id,
            "reset_password",
            &digest,
            now.saturating_add(RESET_TTL_SECONDS),
            now,
        )
        .await?;
    let mailbox = recipient
        .parse::<Mailbox>()
        .map_err(|_| AccountStoreError::Unavailable)?;
    let link = format!(
        "{}/reset-password?token={token}",
        state.app_origin.trim_end_matches('/')
    );
    if state
        .mailer
        .send_action(ActionEmail {
            recipient: mailbox,
            subject: "重置你的 Rust Path 密码".to_owned(),
            body: format!("请在 30 分钟内打开以下链接重置密码：\n\n{link}\n"),
        })
        .await
        .is_err()
    {
        eprintln!("Account password-reset email delivery failed.");
    }
    Ok(())
}

/// 按策略构造一个固定窗口限流桶。
fn limit(
    scope: &'static str,
    key_material: String,
    max_hits: u32,
    window_seconds: i64,
) -> RateLimitRequest {
    RateLimitRequest {
        scope,
        key_material,
        max_hits,
        window_seconds,
    }
}

/// 消耗请求的全部限流桶，并生成带 Retry-After 的 429 响应。
async fn apply_limits(
    store: &AccountStore,
    limits: &[RateLimitRequest],
    now: i64,
) -> Option<Response> {
    match consume_limits(store, limits, now).await {
        Ok(RateLimitDecision::Allowed) => None,
        Ok(RateLimitDecision::Limited {
            retry_after_seconds,
        }) => {
            let mut response = error_response(
                StatusCode::TOO_MANY_REQUESTS,
                "rate_limited",
                "操作过于频繁，请稍后重试。",
                true,
            );
            if let Ok(value) = retry_after_seconds.to_string().parse() {
                response.headers_mut().insert(header::RETRY_AFTER, value);
            }
            Some(response)
        }
        Err(_) => Some(internal_error()),
    }
}

/// 消耗邮箱发送配额，但不在 HTTP 响应中暴露配额是否耗尽。
async fn email_send_allowed(store: &AccountStore, email: &str, now: i64) -> bool {
    matches!(
        consume_limits(
            store,
            &[limit("email_send", email.to_owned(), 3, 3600)],
            now,
        )
        .await,
        Ok(RateLimitDecision::Allowed)
    )
}

/// 返回注册、重发和找回流程共用的通用成功响应。
fn public_accepted() -> Response {
    (
        StatusCode::ACCEPTED,
        Json(PublicMessageResponse {
            message: PUBLIC_MESSAGE,
        }),
    )
        .into_response()
}

/// 构造不含底层诊断的服务暂不可用响应。
fn internal_error() -> Response {
    error_response(
        StatusCode::INTERNAL_SERVER_ERROR,
        "service_unavailable",
        "服务暂不可用，请稍后重试。",
        true,
    )
}

/// 为未知邮箱和错误密码生成相同的登录失败响应。
fn invalid_credentials() -> Response {
    error_response(
        StatusCode::UNAUTHORIZED,
        "invalid_credentials",
        "邮箱或密码不正确。",
        false,
    )
}

/// 构造带稳定错误码和唯一 request_id 的 JSON 错误响应。
fn error_response(
    status: StatusCode,
    code: &'static str,
    message: &'static str,
    retryable: bool,
) -> Response {
    let response = ApiError {
        code,
        message,
        request_id: uuid::Uuid::new_v4().to_string(),
        retryable,
    };
    (status, Json(response)).into_response()
}
