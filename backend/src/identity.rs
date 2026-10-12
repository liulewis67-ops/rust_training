//! OIDC 登录、服务端会话和受保护 API。

use axum::{
    Json,
    extract::Request,
    extract::{Query, State},
    http::{HeaderMap, StatusCode, header},
    middleware::Next,
    response::{IntoResponse, Redirect, Response},
};
use openidconnect::{
    AccessTokenHash, AuthorizationCode, ClientId, ClientSecret, CsrfToken, EndpointMaybeSet,
    EndpointNotSet, EndpointSet, Nonce, OAuth2TokenResponse, PkceCodeChallenge, PkceCodeVerifier,
    RedirectUrl, Scope, TokenResponse,
    core::{CoreAuthenticationFlow, CoreClient, CoreProviderMetadata},
};
use serde::{Deserialize, Serialize};
use tower_sessions::Session;

const STATE_KEY: &str = "oidc_state";
const NONCE_KEY: &str = "oidc_nonce";
const VERIFIER_KEY: &str = "oidc_pkce_verifier";
const USER_KEY: &str = "user_id";

/// 表示发现元数据和回调地址均已完成配置的 OIDC 客户端。
type ConfiguredClient = CoreClient<
    EndpointSet,
    EndpointNotSet,
    EndpointNotSet,
    EndpointNotSet,
    EndpointMaybeSet,
    EndpointMaybeSet,
>;

/// 当前 API 实例使用的 OIDC 客户端、受限 HTTP 客户端和来源白名单。
#[derive(Clone)]
pub struct AppState {
    client: ConfiguredClient,
    http_client: openidconnect::reqwest::Client,
    allowed_origin: String,
}

impl AppState {
    /// 创建身份模块状态；来源必须是不带路径的可信站点 origin。
    pub fn new(
        client: ConfiguredClient,
        http_client: openidconnect::reqwest::Client,
        allowed_origin: String,
    ) -> Self {
        Self {
            client,
            http_client,
            allowed_origin,
        }
    }
}

/// 由固定 discovery 元数据创建客户端，并锁定唯一回调地址。
pub fn build_client(
    provider: CoreProviderMetadata,
    client_id: String,
    client_secret: String,
    redirect_url: String,
) -> Result<ConfiguredClient, Box<dyn std::error::Error>> {
    let client = CoreClient::from_provider_metadata(
        provider,
        ClientId::new(client_id),
        Some(ClientSecret::new(client_secret)),
    )
    .set_redirect_uri(RedirectUrl::new(redirect_url)?);
    Ok(client)
}

/// 建立 state、nonce 与 PKCE verifier，并将它们留在服务端 session 中。
pub async fn login(State(state): State<AppState>, session: Session) -> Response {
    let (challenge, verifier) = PkceCodeChallenge::new_random_sha256();
    let (url, csrf, nonce) = state
        .client
        .authorize_url(
            CoreAuthenticationFlow::AuthorizationCode,
            CsrfToken::new_random,
            Nonce::new_random,
        )
        .add_scope(Scope::new("openid".to_owned()))
        .add_scope(Scope::new("profile".to_owned()))
        .set_pkce_challenge(challenge)
        .url();

    if session.insert(STATE_KEY, csrf.secret()).await.is_err()
        || session.insert(NONCE_KEY, nonce.secret()).await.is_err()
        || session
            .insert(VERIFIER_KEY, verifier.secret())
            .await
            .is_err()
    {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }
    Redirect::temporary(url.as_str()).into_response()
}

/// 验证回调 state，交换授权码并校验签名、audience、issuer 与 nonce。
pub async fn callback(
    State(state): State<AppState>,
    session: Session,
    Query(query): Query<CallbackQuery>,
) -> Response {
    let expected_state = match session.remove::<String>(STATE_KEY).await {
        Ok(Some(value)) => value,
        Ok(None) => return StatusCode::BAD_REQUEST.into_response(),
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };
    let expected_nonce = match session.remove::<String>(NONCE_KEY).await {
        Ok(Some(value)) => value,
        Ok(None) => return StatusCode::BAD_REQUEST.into_response(),
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };
    let verifier = match session.remove::<String>(VERIFIER_KEY).await {
        Ok(Some(value)) => value,
        Ok(None) => return StatusCode::BAD_REQUEST.into_response(),
        Err(_) => return StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    };
    if !callback_state_matches(query.state.as_deref(), &expected_state) {
        return StatusCode::BAD_REQUEST.into_response();
    }
    if query.error.is_some() {
        let _ = session.remove::<String>(NONCE_KEY).await;
        let _ = session.remove::<String>(VERIFIER_KEY).await;
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let Some(code) = query.code else {
        return StatusCode::BAD_REQUEST.into_response();
    };

    let exchange = match state.client.exchange_code(AuthorizationCode::new(code)) {
        Ok(request) => request.set_pkce_verifier(PkceCodeVerifier::new(verifier)),
        Err(_) => return StatusCode::UNAUTHORIZED.into_response(),
    };
    let token = match exchange.request_async(&state.http_client).await {
        Ok(token) => token,
        Err(_) => return StatusCode::UNAUTHORIZED.into_response(),
    };
    let Some(id_token) = token.id_token() else {
        return StatusCode::UNAUTHORIZED.into_response();
    };
    let claims = match id_token.claims(
        &state.client.id_token_verifier(),
        &Nonce::new(expected_nonce),
    ) {
        Ok(claims) => claims,
        Err(_) => return StatusCode::UNAUTHORIZED.into_response(),
    };
    if let Some(expected_hash) = claims.access_token_hash() {
        let verifier = state.client.id_token_verifier();
        let algorithm = match id_token.signing_alg() {
            Ok(algorithm) => algorithm,
            Err(_) => return StatusCode::UNAUTHORIZED.into_response(),
        };
        let signing_key = match id_token.signing_key(&verifier) {
            Ok(signing_key) => signing_key,
            Err(_) => return StatusCode::UNAUTHORIZED.into_response(),
        };
        let actual_hash =
            match AccessTokenHash::from_token(token.access_token(), algorithm, signing_key) {
                Ok(hash) => hash,
                Err(_) => return StatusCode::UNAUTHORIZED.into_response(),
            };
        if actual_hash != *expected_hash {
            return StatusCode::UNAUTHORIZED.into_response();
        }
    }

    // 登录成功时轮换 session ID，防止认证前分配的 ID 被提升为已认证会话。
    if session.cycle_id().await.is_err()
        || session
            .insert(USER_KEY, claims.subject().as_str())
            .await
            .is_err()
    {
        return StatusCode::INTERNAL_SERVER_ERROR.into_response();
    }
    let return_url = format!("{}/", state.allowed_origin.trim_end_matches('/'));
    Redirect::temporary(&return_url).into_response()
}

/// 返回当前会话的用户身份，未登录返回 401。
pub async fn session_info(session: Session) -> Response {
    match session.get::<String>(USER_KEY).await {
        Ok(Some(user_id)) => Json(SessionInfo { user_id }).into_response(),
        Ok(None) => StatusCode::UNAUTHORIZED.into_response(),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

/// 删除服务端会话，并在缺少或不匹配 Origin 时拒绝变更请求。
pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
    session: Session,
) -> Response {
    if !valid_origin(&headers, &state.allowed_origin) {
        return StatusCode::FORBIDDEN.into_response();
    }
    match session.delete().await {
        Ok(()) => StatusCode::NO_CONTENT.into_response(),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

/// 对所有变更请求执行精确 Origin 校验，覆盖新增的写接口。
pub async fn csrf_origin_guard(
    State(state): State<AppState>,
    request: Request,
    next: Next,
) -> Response {
    let safe_method = matches!(
        *request.method(),
        axum::http::Method::GET | axum::http::Method::HEAD | axum::http::Method::OPTIONS
    );
    if !safe_method && !valid_origin(request.headers(), &state.allowed_origin) {
        return StatusCode::FORBIDDEN.into_response();
    }
    next.run(request).await
}

/// 阻止匿名访问 workspace API，身份来源只取服务端 session。
pub async fn private_workspace(session: Session) -> Response {
    match session.get::<String>(USER_KEY).await {
        Ok(Some(user_id)) => Json(PrivateWorkspaceResponse { owner_id: user_id }).into_response(),
        Ok(None) => StatusCode::UNAUTHORIZED.into_response(),
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR.into_response(),
    }
}

/// 精确匹配浏览器 Origin，禁止缺失来源或跨站变更请求。
fn valid_origin(headers: &HeaderMap, allowed_origin: &str) -> bool {
    headers
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|origin| origin == allowed_origin)
}

/// 比较 provider 回调返回值与 session 中的一次性 state。
fn callback_state_matches(received: Option<&str>, expected: &str) -> bool {
    received.is_some_and(|value| value == expected)
}

/// OIDC 授权回调中从固定 query 参数读取一次性授权数据。
#[derive(Deserialize)]
pub struct CallbackQuery {
    code: Option<String>,
    state: Option<String>,
    error: Option<String>,
}

/// 当前登录身份的最小可见 DTO。
#[derive(Serialize)]
pub struct SessionInfo {
    user_id: String,
}

/// workspace 受保护路由的最小响应 DTO。
#[derive(Serialize)]
pub struct PrivateWorkspaceResponse {
    owner_id: String,
}

#[cfg(test)]
mod tests {
    use super::{callback_state_matches, valid_origin};
    use axum::{
        Router,
        body::Body,
        http::{HeaderMap, HeaderValue, Request as HttpRequest, StatusCode, header},
        routing::get,
    };
    use tower::ServiceExt;
    use tower_sessions::{Session, SessionManagerLayer};

    /// 精确验证 Origin 且拒绝缺失、伪造或带路径的来源。
    #[test]
    fn origin_must_match_exactly() {
        let mut headers = HeaderMap::new();
        assert!(!valid_origin(&headers, "https://academy.example"));

        headers.insert(
            header::ORIGIN,
            HeaderValue::from_static("https://attacker.example"),
        );
        assert!(!valid_origin(&headers, "https://academy.example"));

        headers.insert(
            header::ORIGIN,
            HeaderValue::from_static("https://academy.example/path"),
        );
        assert!(!valid_origin(&headers, "https://academy.example"));

        headers.insert(
            header::ORIGIN,
            HeaderValue::from_static("https://academy.example"),
        );
        assert!(valid_origin(&headers, "https://academy.example"));
    }

    /// 拒绝缺失或伪造 state，仅接受当前 session 生成的一次性值。
    #[test]
    fn callback_requires_matching_state() {
        assert!(!callback_state_matches(None, "expected"));
        assert!(!callback_state_matches(Some("attacker"), "expected"));
        assert!(callback_state_matches(Some("expected"), "expected"));
    }

    /// 测试路由通过服务端 session 建立身份，仅用于授权路由测试。
    async fn seed_session(session: Session) -> StatusCode {
        session
            .insert(super::USER_KEY, "student-1")
            .await
            .expect("in-memory session store should accept a test identity");
        StatusCode::NO_CONTENT
    }

    /// 使用退出流程相同的服务端删除操作撤销测试会话。
    async fn revoke_session(session: Session) -> StatusCode {
        match session.delete().await {
            Ok(()) => StatusCode::NO_CONTENT,
            Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    /// 为每项测试创建独立内存 SQLite 数据库中的真实会话存储。
    async fn test_session_store() -> super::super::sessions::SqliteSessionStore {
        super::super::sessions::SqliteSessionStore::connect("sqlite::memory:")
            .await
            .expect("in-memory SQLite session store should initialize")
    }

    /// 验证匿名请求访问私有工作区会被拒绝。
    #[tokio::test]
    async fn private_route_rejects_anonymous_requests() {
        let app = Router::new()
            .route("/private", get(super::private_workspace))
            .layer(SessionManagerLayer::new(test_session_store().await).with_secure(false));
        let response = app
            .oneshot(
                HttpRequest::builder()
                    .uri("/private")
                    .body(Body::empty())
                    .expect("request builder should accept a static URI"),
            )
            .await
            .expect("router should return an HTTP response");
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    /// 验证私有路由读取服务端 session 中的用户身份。
    #[tokio::test]
    async fn private_route_reads_identity_from_server_session() {
        let app = Router::new()
            .route("/seed", get(seed_session))
            .route("/revoke", axum::routing::post(revoke_session))
            .route("/private", get(super::private_workspace))
            .layer(SessionManagerLayer::new(test_session_store().await).with_secure(false));
        let seeded = app
            .clone()
            .oneshot(
                HttpRequest::builder()
                    .uri("/seed")
                    .body(Body::empty())
                    .expect("request builder should accept a static URI"),
            )
            .await
            .expect("router should seed a session");
        let cookie = seeded
            .headers()
            .get(header::SET_COOKIE)
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(';').next())
            .expect("session middleware should issue a cookie");
        let response = app
            .clone()
            .oneshot(
                HttpRequest::builder()
                    .uri("/private")
                    .header(header::COOKIE, cookie)
                    .body(Body::empty())
                    .expect("request builder should accept a session cookie"),
            )
            .await
            .expect("router should return an authorized response");
        assert_eq!(response.status(), StatusCode::OK);

        let revoked = app
            .clone()
            .oneshot(
                HttpRequest::builder()
                    .method(axum::http::Method::POST)
                    .uri("/revoke")
                    .header(header::COOKIE, cookie)
                    .body(Body::empty())
                    .expect("request builder should accept a session cookie"),
            )
            .await
            .expect("router should revoke the server session");
        assert_eq!(revoked.status(), StatusCode::NO_CONTENT);

        let after_revoke = app
            .oneshot(
                HttpRequest::builder()
                    .uri("/private")
                    .header(header::COOKIE, cookie)
                    .body(Body::empty())
                    .expect("request builder should accept the revoked session cookie"),
            )
            .await
            .expect("router should reject a revoked session");
        assert_eq!(after_revoke.status(), StatusCode::UNAUTHORIZED);
    }
}
