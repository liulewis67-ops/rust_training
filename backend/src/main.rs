//! Rust Path 业务 API 启动入口。

use std::{env, net::SocketAddr, sync::Arc, time::Duration};

use axum::{Router, routing::get};
use openidconnect::{IssuerUrl, core::CoreProviderMetadata};
use tower_sessions::{Expiry, SessionManagerLayer};

mod accounts;
mod identity;
mod learning;
mod sessions;
mod workspaces;

/// 读取本地账号配置；仅在显式启用时发现 OIDC 提供方并启动 API 服务。
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let allowed_origin = required_env("APP_ORIGIN")?;
    let database_url = required_env("DATABASE_URL")?;
    let oidc_enabled =
        env::var("OIDC_ENABLED").is_ok_and(|value| value.eq_ignore_ascii_case("true"));
    let cookie_secure = match env::var("COOKIE_SECURE") {
        Ok(value) => value != "false",
        Err(_) => true,
    };
    validate_app_origin(&allowed_origin, cookie_secure)?;
    let bind_address = match env::var("API_BIND_ADDRESS") {
        Ok(value) => value,
        Err(_) => "127.0.0.1:3000".into(),
    };
    let address: SocketAddr = bind_address.parse()?;

    let session_store = sessions::SqliteSessionStore::connect(&database_url).await?;
    let account_store = accounts::store::AccountStore::connect(&database_url).await?;
    let cleanup_accounts = account_store.clone();
    tokio::spawn(async move {
        cleanup_accounts.cleanup_expired_periodically().await;
    });
    let smtp = accounts::mailer::SmtpConfig::from_env()
        .map_err(|error| format!("SMTP configuration error: {error:?}"))?;
    let mailer = Arc::new(
        accounts::mailer::SmtpMailer::new(smtp)
            .map_err(|error| format!("SMTP configuration error: {error:?}"))?,
    );
    let workspace_store = workspaces::WorkspaceStore::connect(&database_url).await?;
    let learning_store = learning::LearningStore::connect(&database_url).await?;
    let cleanup_store = session_store.clone();
    // Expiry cleanup runs separately so a transient cleanup error cannot interrupt API requests.
    tokio::spawn(async move {
        cleanup_store.delete_expired_periodically().await;
    });
    let cookie_name = if cookie_secure {
        "__Host-rust-path-session"
    } else {
        "rust-path-session"
    };
    let session_layer = SessionManagerLayer::new(session_store)
        .with_name(cookie_name)
        .with_secure(cookie_secure)
        .with_http_only(true)
        .with_same_site(tower_sessions::cookie::SameSite::Lax)
        .with_expiry(Expiry::OnInactivity(time::Duration::hours(12)));
    let mut app = Router::new()
        .merge(accounts::router(
            account_store,
            mailer,
            allowed_origin.clone(),
        ))
        .route("/api/v1/auth/session", get(accounts::session_info))
        .route("/api/v1/auth/logout", axum::routing::post(accounts::logout))
        .route(
            "/api/v1/private/workspaces",
            get(identity::private_workspace),
        )
        .merge(workspaces::router(workspace_store))
        .merge(learning::router(learning_store))
        .layer(session_layer);

    if oidc_enabled {
        let issuer = required_env("OIDC_ISSUER_URL")?;
        let client_id = required_env("OIDC_CLIENT_ID")?;
        let client_secret = required_env("OIDC_CLIENT_SECRET")?;
        let redirect_url = required_env("OIDC_REDIRECT_URL")?;
        // 不跟随身份提供方的跳转，避免 discovery 请求被重定向到未授权地址。
        let http_client = openidconnect::reqwest::ClientBuilder::new()
            .redirect(openidconnect::reqwest::redirect::Policy::none())
            .timeout(Duration::from_secs(10))
            .build()?;
        let provider =
            CoreProviderMetadata::discover_async(IssuerUrl::new(issuer)?, &http_client).await?;
        let state = identity::AppState::new(
            identity::build_client(provider, client_id, client_secret, redirect_url)?,
            http_client,
            allowed_origin.clone(),
        );
        let oidc_routes = Router::new()
            .route("/api/v1/auth/oidc/login", get(identity::login))
            .route("/api/v1/auth/oidc/callback", get(identity::callback))
            .with_state(state);
        app = app.merge(oidc_routes);
    }
    app = app.layer(axum::middleware::from_fn_with_state(
        allowed_origin,
        identity::csrf_origin_guard,
    ));
    app = app.layer(axum::middleware::from_fn(set_no_referrer));

    let listener = tokio::net::TcpListener::bind(address).await?;
    println!("API listening on {address}");
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;
    Ok(())
}

/// 本地认证响应不携带 Referrer，避免令牌意外流向其它页面。
async fn set_no_referrer(
    request: axum::extract::Request,
    next: axum::middleware::Next,
) -> axum::response::Response {
    let mut response = next.run(request).await;
    response.headers_mut().insert(
        axum::http::header::REFERRER_POLICY,
        axum::http::HeaderValue::from_static("no-referrer"),
    );
    response
}

/// 读取非空环境变量；未配置时阻止服务以不安全的默认值启动。
fn required_env(name: &str) -> Result<String, Box<dyn std::error::Error>> {
    match env::var(name) {
        Ok(value) if !value.trim().is_empty() => Ok(value),
        _ => Err(format!("required environment variable {name} is missing").into()),
    }
}

/// 只接受站点 origin；非 Secure Cookie 仅允许用于本机 Vite 开发源。
fn validate_app_origin(
    origin: &str,
    cookie_secure: bool,
) -> Result<(), Box<dyn std::error::Error>> {
    let uri: axum::http::Uri = origin.parse()?;
    let scheme = uri.scheme_str();
    let is_origin_only = uri.authority().is_some()
        && uri.path() == "/"
        && !origin.ends_with('/')
        && !origin.contains(['?', '#']);
    if !is_origin_only || !matches!(scheme, Some("http" | "https")) {
        return Err("APP_ORIGIN must be an origin without a path, query, or fragment".into());
    }
    if cookie_secure && scheme != Some("https") {
        return Err("COOKIE_SECURE=true requires an HTTPS APP_ORIGIN".into());
    }
    if !cookie_secure && !matches!(origin, "http://localhost:5173" | "http://127.0.0.1:5173") {
        return Err("COOKIE_SECURE=false is restricted to the local Vite origin".into());
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use axum::{
        Router,
        http::{Request, StatusCode, header},
        routing::get,
    };
    use tower::ServiceExt;

    use super::validate_app_origin;

    /// 本地 Vite origin 可用于 Secure=false 的开发 Cookie。
    #[test]
    fn allows_loopback_origin_for_development_cookie() {
        assert!(validate_app_origin("http://localhost:5173", false).is_ok());
    }

    /// 阻止不安全 Cookie 配置被用于任意远端 HTTP 站点。
    #[test]
    fn rejects_insecure_cookie_for_remote_origin() {
        assert!(validate_app_origin("http://academy.example", false).is_err());
        assert!(validate_app_origin("https://academy.example", true).is_ok());
    }

    /// CSRF Origin 只能配置为纯 origin，不能扩大到站点路径。
    #[test]
    fn rejects_app_origin_with_path_or_query() {
        assert!(validate_app_origin("https://academy.example/learn", true).is_err());
        assert!(validate_app_origin("https://academy.example?next=/", true).is_err());
    }

    /// 所有 API 响应均设置 no-referrer，保护含令牌的浏览器地址。
    #[tokio::test]
    async fn auth_responses_include_no_referrer_policy() {
        let app = Router::new()
            .route("/", get(|| async { StatusCode::NO_CONTENT }))
            .layer(axum::middleware::from_fn(super::set_no_referrer));
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/")
                    .body(axum::body::Body::empty())
                    .expect("request should build"),
            )
            .await
            .expect("middleware should return response");
        assert_eq!(response.headers()[header::REFERRER_POLICY], "no-referrer");
    }
}
