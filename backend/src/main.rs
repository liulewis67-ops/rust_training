//! Rust Path 业务 API 启动入口。

use std::{env, net::SocketAddr, time::Duration};

use axum::{Router, routing::get};
use openidconnect::{IssuerUrl, core::CoreProviderMetadata};
use tower_sessions::{Expiry, SessionManagerLayer};

mod identity;
mod sessions;
mod workspaces;

/// 读取运行配置、发现 OIDC 提供方并启动 API 服务。
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let issuer = required_env("OIDC_ISSUER_URL")?;
    let client_id = required_env("OIDC_CLIENT_ID")?;
    let client_secret = required_env("OIDC_CLIENT_SECRET")?;
    let redirect_url = required_env("OIDC_REDIRECT_URL")?;
    let allowed_origin = required_env("APP_ORIGIN")?;
    let database_url = required_env("DATABASE_URL")?;
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

    // 不跟随身份提供方的跳转，避免发现文档或密钥请求被重定向到未授权地址。
    let http_client = openidconnect::reqwest::ClientBuilder::new()
        .redirect(openidconnect::reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(10))
        .build()?;
    let provider =
        CoreProviderMetadata::discover_async(IssuerUrl::new(issuer)?, &http_client).await?;
    let client = identity::build_client(provider, client_id, client_secret, redirect_url)?;

    let session_store = sessions::SqliteSessionStore::connect(&database_url).await?;
    let workspace_store = workspaces::WorkspaceStore::connect(&database_url).await?;
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
    let state = identity::AppState::new(client, http_client, allowed_origin);
    let app = Router::new()
        .route("/api/v1/auth/login", get(identity::login))
        .route("/api/v1/auth/callback", get(identity::callback))
        .route("/api/v1/auth/session", get(identity::session_info))
        .route("/api/v1/auth/logout", axum::routing::post(identity::logout))
        .route(
            "/api/v1/private/workspaces",
            get(identity::private_workspace),
        )
        .with_state(state.clone())
        .merge(workspaces::router(workspace_store))
        .layer(session_layer)
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            identity::csrf_origin_guard,
        ));

    let listener = tokio::net::TcpListener::bind(address).await?;
    println!("API listening on {address}");
    axum::serve(listener, app).await?;
    Ok(())
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
}
