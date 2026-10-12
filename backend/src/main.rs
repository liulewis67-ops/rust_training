//! Rust Path 业务 API 启动入口。

use std::{env, net::SocketAddr, time::Duration};

use axum::{Router, routing::get};
use openidconnect::{IssuerUrl, core::CoreProviderMetadata};
use tower_sessions::{Expiry, MemoryStore, SessionManagerLayer};

mod identity;

/// 读取运行配置、发现 OIDC 提供方并启动 API 服务。
#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenvy::dotenv().ok();
    let issuer = required_env("OIDC_ISSUER_URL")?;
    let client_id = required_env("OIDC_CLIENT_ID")?;
    let client_secret = required_env("OIDC_CLIENT_SECRET")?;
    let redirect_url = required_env("OIDC_REDIRECT_URL")?;
    let allowed_origin = required_env("APP_ORIGIN")?;
    let cookie_secure = env::var("COOKIE_SECURE").map_or(true, |value| value != "false");
    let bind_address = env::var("API_BIND_ADDRESS").unwrap_or_else(|_| "127.0.0.1:3000".into());
    let address: SocketAddr = bind_address.parse()?;

    // 不跟随身份提供方的跳转，避免发现文档或密钥请求被重定向到未授权地址。
    let http_client = openidconnect::reqwest::ClientBuilder::new()
        .redirect(openidconnect::reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(10))
        .build()?;
    let provider =
        CoreProviderMetadata::discover_async(IssuerUrl::new(issuer)?, &http_client).await?;
    let client = identity::build_client(provider, client_id, client_secret, redirect_url)?;

    let session_store = MemoryStore::default();
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
        .layer(session_layer)
        .layer(axum::middleware::from_fn_with_state(
            state.clone(),
            identity::csrf_origin_guard,
        ))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(address).await?;
    println!("API listening on {address}");
    axum::serve(listener, app).await?;
    Ok(())
}

/// 读取非空环境变量；未配置时阻止服务以不安全的默认值启动。
fn required_env(name: &str) -> Result<String, Box<dyn std::error::Error>> {
    env::var(name)
        .ok()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("required environment variable {name} is missing").into())
}
