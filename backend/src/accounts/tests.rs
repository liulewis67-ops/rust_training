//! 本地账号模块的 SQLite 迁移与行为测试。

use axum::{
    body::{Body, to_bytes},
    extract::ConnectInfo,
    http::{Request, StatusCode, header},
    middleware,
};
use sqlx::{SqlitePool, sqlite::SqlitePoolOptions};

use super::{
    ValidationError,
    mailer::{ActionEmail, ConfigError, MailError, Mailer, SmtpConfig, SmtpMailer},
    normalize_email,
    rate_limit::{RateLimitDecision, RateLimitRequest, consume_limits},
    security::{
        digest_action_token, hash_password, new_action_token, validate_password, verify_password,
    },
    store::{AccountStore, AccountStoreError},
};
use tower::ServiceExt;
use tower_sessions::{Session, SessionManagerLayer};

/// 创建包含现有 session schema 的内存数据库。
async fn session_database() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("in-memory SQLite database should open");
    sqlx::raw_sql(
        "CREATE TABLE auth_sessions (id TEXT PRIMARY KEY, data TEXT NOT NULL, expiry_unix INTEGER NOT NULL); CREATE INDEX auth_sessions_expiry_unix_idx ON auth_sessions (expiry_unix);",
    )
        .execute(&pool)
        .await
        .expect("pre-account session schema should initialize");
    pool
}

/// 重复应用本地账号迁移不会重复执行 ALTER，也不会改变已有数据。
#[tokio::test]
async fn migration_is_additive_and_idempotent() {
    let pool = session_database().await;
    let store = AccountStore { pool: pool.clone() };

    store
        .migrate()
        .await
        .expect("first account migration should apply");
    sqlx::query(
        "INSERT INTO auth_sessions (id, data, expiry_unix) VALUES ('legacy', '{}', 9999999999)",
    )
    .execute(&pool)
    .await
    .expect("anonymous legacy session should remain valid");
    store
        .migrate()
        .await
        .expect("a second startup should skip the completed migration");

    let user_id: Option<String> =
        sqlx::query_scalar("SELECT user_id FROM auth_sessions WHERE id = 'legacy'")
            .fetch_one(&pool)
            .await
            .expect("new nullable owner column should be available");
    assert_eq!(user_id, None);
}

/// SQLite 约束强制邮箱唯一并限制令牌用途。
#[tokio::test]
async fn migration_enforces_account_and_token_constraints() {
    let pool = session_database().await;
    let store = AccountStore { pool: pool.clone() };
    store
        .migrate()
        .await
        .expect("account migration should apply");
    sqlx::query("INSERT INTO accounts (id, email_normalized, email_display, password_hash, password_changed_at, created_at, updated_at) VALUES ('account-1', 'a@example.test', 'A@example.test', '$argon2id$test', 1, 1, 1)")
        .execute(&pool)
        .await
        .expect("first normalized email should be accepted");

    let duplicate = sqlx::query("INSERT INTO accounts (id, email_normalized, email_display, password_hash, password_changed_at, created_at, updated_at) VALUES ('account-2', 'a@example.test', 'a@example.test', '$argon2id$test', 1, 1, 1)")
        .execute(&pool)
        .await;
    assert!(duplicate.is_err());
    let invalid_purpose = sqlx::query("INSERT INTO account_action_tokens (token_hash, account_id, purpose, expires_at, created_at) VALUES ('token-hash', 'account-1', 'other', 5, 1)")
        .execute(&pool)
        .await;
    assert!(invalid_purpose.is_err());
}

/// 规范化邮箱时保留展示值，并拒绝格式错误地址和控制字符。
#[test]
fn normalizes_and_validates_email() {
    let email = normalize_email("  Alice@Example.Test ").expect("mailbox should be valid");
    assert_eq!(email.normalized, "alice@example.test");
    assert_eq!(email.display, "Alice@Example.Test");
    for invalid in [
        "",
        "missing-at",
        "@example.test",
        "alice@",
        "alice\r@example.test",
    ] {
        assert_eq!(normalize_email(invalid), Err(ValidationError::InvalidEmail));
    }
    assert_eq!(
        normalize_email(&format!("{}@example.test", "a".repeat(250))),
        Err(ValidationError::InvalidEmail)
    );
}

/// SQLite 强制规范化邮箱唯一，并在冲突时返回非敏感错误。
#[tokio::test]
async fn account_store_enforces_unique_normalized_email() {
    let pool = session_database().await;
    let store = AccountStore { pool: pool.clone() };
    store
        .migrate()
        .await
        .expect("account migration should apply");

    let account_id = store
        .create_unverified(
            "alice@example.test",
            "Alice@Example.Test",
            "$argon2id$test",
            1,
        )
        .await
        .expect("the first normalized email should be accepted");
    let account = store
        .find_by_email("alice@example.test")
        .await
        .expect("account lookup should succeed")
        .expect("created account should be found");
    assert_eq!(account.id, account_id);
    assert_eq!(account.email_display, "Alice@Example.Test");
    assert_eq!(account.password_hash, "$argon2id$test");
    assert_eq!(account.email_verified_at, None);

    let duplicate = store
        .create_unverified(
            "alice@example.test",
            "alice@example.test",
            "$argon2id$test",
            2,
        )
        .await;
    assert_eq!(duplicate, Err(AccountStoreError::EmailAlreadyExists));
}

/// 邮箱验证令牌过期后不可使用，并发消费时最多一个请求成功。
#[tokio::test]
async fn verification_tokens_expire_and_allow_only_one_consumer() {
    let pool = session_database().await;
    let store = AccountStore { pool };
    store.migrate().await.expect("account schema should apply");
    let account_id = store
        .create_unverified(
            "token@example.test",
            "token@example.test",
            "$argon2id$test",
            1,
        )
        .await
        .expect("test account should be inserted");
    let (_, token_digest) = new_action_token().expect("CSPRNG should issue a verification token");
    store
        .replace_action_token(&account_id, "verify_email", &token_digest, 1_000, 100)
        .await
        .expect("verification token should persist");

    let mut tasks = tokio::task::JoinSet::new();
    for _ in 0..8 {
        let store = store.clone();
        let token_digest = token_digest.clone();
        tasks.spawn(async move { store.consume_verification_token(&token_digest, 200).await });
    }
    let mut successes = 0;
    while let Some(result) = tasks.join_next().await {
        if result
            .expect("consumer task should complete")
            .expect("store should remain available")
            .is_some()
        {
            successes += 1;
        }
    }
    assert_eq!(successes, 1);

    let (_, expired_digest) = new_action_token().expect("CSPRNG should issue another token");
    store
        .replace_action_token(&account_id, "verify_email", &expired_digest, 200, 101)
        .await
        .expect("expired token fixture should persist");
    assert_eq!(
        store.consume_verification_token(&expired_digest, 200).await,
        Ok(None)
    );
}

/// 密码规则接受 Unicode 长口令，并拒绝范围外长度。
#[test]
fn password_policy_accepts_unicode_and_checks_character_and_byte_limits() {
    assert_eq!(
        validate_password("short-pass"),
        Err(ValidationError::InvalidPassword)
    );
    assert_eq!(validate_password("twelve chars"), Ok(()));
    assert_eq!(validate_password(&"x".repeat(128)), Ok(()));
    assert_eq!(
        validate_password(&"x".repeat(129)),
        Err(ValidationError::InvalidPassword)
    );
    assert_eq!(validate_password("长口令🌱包含足够多的Unicode字符"), Ok(()));
    assert_eq!(
        validate_password(&"界".repeat(171)),
        Err(ValidationError::InvalidPassword)
    );
}

/// Argon2id 使用新 salt 校验密码，并生成不透明令牌摘要。
#[tokio::test]
async fn hashes_password_and_issues_unpredictable_token() {
    let first_hash = hash_password("a secure passphrase".to_owned())
        .await
        .expect("valid password should hash");
    let second_hash = hash_password("a secure passphrase".to_owned())
        .await
        .expect("same password should hash again");
    assert!(first_hash.starts_with("$argon2id$"));
    assert_ne!(first_hash, second_hash);
    assert!(
        verify_password("a secure passphrase".to_owned(), first_hash.clone())
            .await
            .expect("stored password hash should parse")
    );
    assert!(
        !verify_password("wrong passphrase".to_owned(), first_hash)
            .await
            .expect("wrong password is a normal mismatch")
    );

    let (first_token, first_digest) = new_action_token().expect("system CSPRNG should work");
    let (second_token, second_digest) = new_action_token().expect("system CSPRNG should work");
    assert_eq!(first_token.len(), 64);
    assert!(
        first_token
            .chars()
            .all(|character| character.is_ascii_hexdigit())
    );
    assert_ne!(first_token, second_token);
    assert_ne!(first_token, first_digest);
    assert_ne!(first_digest, second_digest);
}

/// SMTP 配置要求 TLS 凭据完整，且错误不回显密码值。
#[test]
fn smtp_config_rejects_missing_or_invalid_fields_without_leaking_secret() {
    let complete = smtp_values();
    assert!(
        SmtpMailer::new(SmtpConfig::from_map(&complete).expect("SMTP config should validate"))
            .is_ok()
    );
    for key in [
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USERNAME",
        "SMTP_PASSWORD",
        "SMTP_FROM",
        "SMTP_TLS",
    ] {
        let mut missing = complete.clone();
        missing.remove(key);
        assert_eq!(
            SmtpConfig::from_map(&missing).err(),
            Some(ConfigError::Missing(key))
        );
    }
    let mut invalid_tls = complete.clone();
    invalid_tls.insert("SMTP_TLS".to_owned(), "opportunistic".to_owned());
    assert_eq!(
        SmtpConfig::from_map(&invalid_tls).err(),
        Some(ConfigError::Invalid("SMTP_TLS"))
    );
    let mut invalid_port = complete;
    invalid_port.insert("SMTP_PORT".to_owned(), "0".to_owned());
    let error = format!(
        "{:?}",
        SmtpConfig::from_map(&invalid_port)
            .err()
            .expect("port should be invalid")
    );
    assert!(error.contains("SMTP_PORT"));
    assert!(!error.contains("secret-sentinel"));
}

/// 假邮件适配器用于捕获消息，不连接 SMTP 服务器。
struct FakeMailer {
    sender: tokio::sync::mpsc::Sender<ActionEmail>,
}

#[async_trait::async_trait]
impl Mailer for FakeMailer {
    /// 将邮件发送到测试接收端，失败时只返回脱敏错误。
    async fn send_action(&self, email: ActionEmail) -> Result<(), MailError> {
        self.sender
            .send(email)
            .await
            .map_err(|_| MailError::Unavailable)
    }
}

/// 假邮件适配器捕获站点生成的一次性操作链接，供 API 测试使用。
#[tokio::test]
async fn fake_mailer_captures_action_link() {
    let (sender, mut receiver) = tokio::sync::mpsc::channel(1);
    let mailer = FakeMailer { sender };
    mailer
        .send_action(ActionEmail {
            recipient: "learner@example.test"
                .parse()
                .expect("test recipient is valid"),
            subject: "Verify your email".to_owned(),
            body: "https://academy.example/verify-email?token=opaque-token".to_owned(),
        })
        .await
        .expect("fake delivery should succeed");
    let received = receiver.recv().await.expect("mail should be captured");
    assert_eq!(received.recipient.email.to_string(), "learner@example.test");
    assert_eq!(received.subject, "Verify your email");
    assert!(
        received
            .body
            .contains("https://academy.example/verify-email?token=")
    );
}

/// 为配置测试构造有效 SMTP 参数，不使用真实凭据。
fn smtp_values() -> std::collections::HashMap<String, String> {
    [
        ("SMTP_HOST", "smtp.example.test"),
        ("SMTP_PORT", "587"),
        ("SMTP_USERNAME", "sender"),
        ("SMTP_PASSWORD", "secret-sentinel"),
        ("SMTP_FROM", "Rust Path <noreply@example.test>"),
        ("SMTP_TLS", "starttls_required"),
    ]
    .into_iter()
    .map(|(key, value)| (key.to_owned(), value.to_owned()))
    .collect()
}

/// 固定窗口桶在达到配额后拒绝请求，并在过期时重新开放。
#[tokio::test]
async fn rate_limit_enforces_fixed_window_and_isolates_keys() {
    let pool = session_database().await;
    let store = AccountStore { pool };
    store
        .migrate()
        .await
        .expect("account migration should apply");
    let request = |material: &str| RateLimitRequest {
        scope: "login_email",
        key_material: material.to_owned(),
        max_hits: 10,
        window_seconds: 60,
    };

    for _ in 0..10 {
        assert_eq!(
            consume_limits(&store, &[request("alice")], 100).await,
            Ok(RateLimitDecision::Allowed)
        );
    }
    assert_eq!(
        consume_limits(&store, &[request("alice")], 110).await,
        Ok(RateLimitDecision::Limited {
            retry_after_seconds: 50
        })
    );
    assert_eq!(
        consume_limits(&store, &[request("bob")], 110).await,
        Ok(RateLimitDecision::Allowed)
    );
    assert_eq!(
        consume_limits(&store, &[request("alice")], 160).await,
        Ok(RateLimitDecision::Allowed)
    );
}

/// 并发 SQLite 请求不会超过账号操作配置的配额。
#[tokio::test]
async fn rate_limit_concurrent_requests_stay_within_quota() {
    let pool = session_database().await;
    let store = AccountStore { pool };
    store
        .migrate()
        .await
        .expect("account migration should apply");
    let mut tasks = tokio::task::JoinSet::new();
    for _ in 0..20 {
        let store = store.clone();
        tasks.spawn(async move {
            consume_limits(
                &store,
                &[RateLimitRequest {
                    scope: "register_ip",
                    key_material: "127.0.0.1".to_owned(),
                    max_hits: 5,
                    window_seconds: 3600,
                }],
                100,
            )
            .await
            .expect("rate limit storage should work")
        });
    }
    let mut allowed = 0;
    while let Some(result) = tasks.join_next().await {
        if result.expect("limit task should finish") == RateLimitDecision::Allowed {
            allowed += 1;
        }
    }
    assert_eq!(allowed, 5);
}

/// 注册、验证、登录、重置密码和撤销会话通过真实 Axum 与 SQLite 路由串联。
#[tokio::test]
async fn local_account_flow_verifies_and_revokes_sessions_after_password_reset() {
    let pool = session_database().await;
    let store = AccountStore { pool: pool.clone() };
    store.migrate().await.expect("account schema should apply");
    let (sender, mut receiver) = tokio::sync::mpsc::channel(8);
    let app = super::routes::router(
        store.clone(),
        std::sync::Arc::new(FakeMailer { sender }),
        "http://localhost:5173".to_owned(),
    )
    .route("/seed-session", axum::routing::get(seed_anonymous_session))
    .route(
        "/api/v1/auth/session",
        axum::routing::get(super::routes::session_info),
    )
    .route(
        "/api/v1/auth/logout",
        axum::routing::post(super::routes::logout),
    )
    .layer(
        SessionManagerLayer::new(crate::sessions::SqliteSessionStore::from_pool(pool.clone()))
            .with_secure(false),
    )
    .layer(middleware::from_fn_with_state(
        "http://localhost:5173".to_owned(),
        crate::identity::csrf_origin_guard,
    ));

    let registered = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/register",
            serde_json::json!({
                "email": "Learner@example.test",
                "password": "correct horse battery"
            }),
        ))
        .await
        .expect("register endpoint should respond");
    assert_eq!(registered.status(), StatusCode::ACCEPTED);
    let public_body = to_bytes(registered.into_body(), 2048)
        .await
        .expect("response body should fit");
    let public_payload: serde_json::Value =
        serde_json::from_slice(&public_body).expect("generic response should be JSON");
    let verification_mail = receiver
        .recv()
        .await
        .expect("new account should receive a verification email");
    let verification_token = verification_mail
        .body
        .split("?token=")
        .nth(1)
        .expect("verification link should contain a token")
        .trim();
    assert_eq!(verification_token.len(), 64);

    let verified = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/verify-email",
            serde_json::json!({ "token": verification_token }),
        ))
        .await
        .expect("verification endpoint should respond");
    assert_eq!(verified.status(), StatusCode::NO_CONTENT);
    let replayed_verification = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/verify-email",
            serde_json::json!({ "token": verification_token }),
        ))
        .await
        .expect("verification replay should respond");
    assert_eq!(replayed_verification.status(), StatusCode::BAD_REQUEST);
    assert!(
        receiver.try_recv().is_err(),
        "verification should not send another email"
    );

    let anonymous = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/seed-session")
                .body(Body::empty())
                .expect("anonymous session request should build"),
        )
        .await
        .expect("anonymous session should be seeded");
    let anonymous_cookie = anonymous.headers()[header::SET_COOKIE]
        .to_str()
        .expect("seed should set a cookie")
        .split(';')
        .next()
        .expect("cookie pair should exist")
        .to_owned();
    let mut login_request = auth_post(
        "/api/v1/auth/login",
        serde_json::json!({
            "email": "learner@example.test",
            "password": "correct horse battery"
        }),
    );
    login_request.headers_mut().insert(
        header::COOKIE,
        anonymous_cookie
            .parse()
            .expect("cookie header should parse"),
    );
    let login = app
        .clone()
        .oneshot(login_request)
        .await
        .expect("login endpoint should respond");
    assert_eq!(login.status(), StatusCode::OK);
    let cookie = login.headers()[header::SET_COOKIE]
        .to_str()
        .expect("login should set session cookie")
        .split(';')
        .next()
        .expect("cookie pair should exist")
        .to_owned();
    assert_ne!(cookie, anonymous_cookie);
    let active_session = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/auth/session")
                .header(header::COOKIE, cookie.clone())
                .body(Body::empty())
                .expect("session request should build"),
        )
        .await
        .expect("active session should respond");
    assert_eq!(active_session.status(), StatusCode::OK);
    let active_body = to_bytes(active_session.into_body(), 1024)
        .await
        .expect("session response should fit");
    let active_payload: serde_json::Value =
        serde_json::from_slice(&active_body).expect("active session response should be JSON");
    assert_eq!(active_payload["email"], "Learner@example.test");
    let account_id: String = sqlx::query_scalar(
        "SELECT id FROM accounts WHERE email_normalized = 'learner@example.test'",
    )
    .fetch_one(&pool)
    .await
    .expect("verified account should exist");
    let stored_owner: String =
        sqlx::query_scalar("SELECT user_id FROM auth_sessions WHERE user_id = ?")
            .bind(&account_id)
            .fetch_one(&pool)
            .await
            .expect("login should synchronize the session owner column");
    assert_eq!(stored_owner, account_id);
    sqlx::query("INSERT INTO auth_sessions (id, data, user_id, expiry_unix) VALUES ('other-account-session', '{\"user_id\":\"other-account\"}', 'other-account', 9999999999)")
        .execute(&pool)
        .await
        .expect("another account session should be seeded");

    let recovery = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/forgot-password",
            serde_json::json!({ "email": "learner@example.test" }),
        ))
        .await
        .expect("password recovery should respond");
    assert_eq!(recovery.status(), StatusCode::ACCEPTED);
    let reset_email = receiver
        .recv()
        .await
        .expect("verified account should receive reset email");
    let reset_token = reset_email
        .body
        .split("?token=")
        .nth(1)
        .expect("reset link should contain token")
        .trim()
        .to_owned();
    let reset = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/reset-password",
            serde_json::json!({
                "token": reset_token.clone(),
                "new_password": "a different strong passphrase"
            }),
        ))
        .await
        .expect("reset endpoint should respond");
    assert_eq!(reset.status(), StatusCode::NO_CONTENT);
    let reset_replay = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/reset-password",
            serde_json::json!({
                "token": reset_token,
                "new_password": "a second different strong passphrase"
            }),
        ))
        .await
        .expect("reset token replay should respond");
    assert_eq!(reset_replay.status(), StatusCode::BAD_REQUEST);
    let remaining_sessions: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM auth_sessions WHERE user_id = ?")
            .bind(&account_id)
            .fetch_one(&pool)
            .await
            .expect("session count should be queryable");
    assert_eq!(remaining_sessions, 0);
    let other_sessions: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM auth_sessions WHERE user_id = 'other-account'")
            .fetch_one(&pool)
            .await
            .expect("other account session count should be queryable");
    assert_eq!(other_sessions, 1);

    let revoked = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/api/v1/auth/session")
                .header(header::COOKIE, cookie)
                .body(Body::empty())
                .expect("session check request should build"),
        )
        .await
        .expect("revoked session lookup should respond");
    assert_eq!(revoked.status(), StatusCode::UNAUTHORIZED);
    let old_password = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/login",
            serde_json::json!({
                "email": "learner@example.test",
                "password": "correct horse battery"
            }),
        ))
        .await
        .expect("old password attempt should respond");
    assert_eq!(old_password.status(), StatusCode::UNAUTHORIZED);
    let new_password = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/login",
            serde_json::json!({
                "email": "learner@example.test",
                "password": "a different strong passphrase"
            }),
        ))
        .await
        .expect("new password attempt should respond");
    assert_eq!(new_password.status(), StatusCode::OK);
    let fresh_cookie = new_password.headers()[header::SET_COOKIE]
        .to_str()
        .expect("new login should issue a session cookie")
        .split(';')
        .next()
        .expect("fresh cookie pair should exist")
        .to_owned();
    let mut logout_request = auth_post("/api/v1/auth/logout", serde_json::json!({}));
    logout_request.headers_mut().insert(
        header::COOKIE,
        fresh_cookie
            .parse()
            .expect("fresh cookie header should parse"),
    );
    let logged_out = app
        .oneshot(logout_request)
        .await
        .expect("logout should respond");
    assert_eq!(logged_out.status(), StatusCode::NO_CONTENT);
    assert_eq!(
        public_payload["message"],
        "如果该邮箱需要操作，请检查收件箱。"
    );
}

/// 密码找回对不存在、未验证和已验证邮箱返回完全相同的响应。
#[tokio::test]
async fn forgot_password_response_does_not_reveal_account_state() {
    let pool = session_database().await;
    let store = AccountStore { pool: pool.clone() };
    store.migrate().await.expect("account schema should apply");
    store
        .create_unverified(
            "pending@example.test",
            "pending@example.test",
            "$argon2id$test",
            1,
        )
        .await
        .expect("unverified account should be inserted");
    let verified = store
        .create_unverified(
            "member@example.test",
            "member@example.test",
            "$argon2id$test",
            1,
        )
        .await
        .expect("verified account fixture should be inserted");
    sqlx::query("UPDATE accounts SET email_verified_at = 1 WHERE id = ?")
        .bind(verified)
        .execute(&pool)
        .await
        .expect("verified account fixture should be marked verified");

    let (sender, mut receiver) = tokio::sync::mpsc::channel(4);
    let app = super::routes::router(
        store,
        std::sync::Arc::new(FakeMailer { sender }),
        "http://localhost:5173".to_owned(),
    )
    .layer(
        SessionManagerLayer::new(crate::sessions::SqliteSessionStore::from_pool(pool.clone()))
            .with_secure(false),
    )
    .layer(middleware::from_fn_with_state(
        "http://localhost:5173".to_owned(),
        crate::identity::csrf_origin_guard,
    ));
    let mut responses = Vec::new();
    for email in [
        "unknown@example.test",
        "pending@example.test",
        "member@example.test",
    ] {
        let response = app
            .clone()
            .oneshot(auth_post(
                "/api/v1/auth/forgot-password",
                serde_json::json!({ "email": email }),
            ))
            .await
            .expect("password-recovery endpoint should respond");
        assert_eq!(response.status(), StatusCode::ACCEPTED);
        responses.push(
            to_bytes(response.into_body(), 1024)
                .await
                .expect("generic response should fit the test body limit")
                .to_vec(),
        );
    }
    assert_eq!(responses[0], responses[1]);
    assert_eq!(responses[1], responses[2]);
    let message = receiver
        .recv()
        .await
        .expect("only verified account should receive recovery email");
    let reset_token = message
        .body
        .split("/reset-password?token=")
        .nth(1)
        .expect("recovery message should contain a reset link")
        .trim();
    let reset_digest =
        digest_action_token(reset_token).expect("generated reset token should be valid");
    let stored_ttl: i64 = sqlx::query_scalar(
        "SELECT expires_at - created_at FROM account_action_tokens WHERE token_hash = ? AND purpose = 'reset_password'",
    )
    .bind(reset_digest)
    .fetch_one(&pool)
    .await
    .expect("only the generated token digest should be stored");
    assert_eq!(stored_ttl, 30 * 60);
    assert!(receiver.try_recv().is_err());
}

/// 重复注册对外响应一致，未验证账号替换令牌，已验证账号不会再次发送邮件。
#[tokio::test]
async fn registration_replaces_pending_tokens_without_revealing_account_state() {
    let pool = session_database().await;
    let store = AccountStore { pool: pool.clone() };
    store.migrate().await.expect("account schema should apply");
    let (sender, mut receiver) = tokio::sync::mpsc::channel(4);
    let app = super::routes::router(
        store,
        std::sync::Arc::new(FakeMailer { sender }),
        "http://localhost:5173".to_owned(),
    )
    .layer(
        SessionManagerLayer::new(crate::sessions::SqliteSessionStore::from_pool(pool.clone()))
            .with_secure(false),
    )
    .layer(middleware::from_fn_with_state(
        "http://localhost:5173".to_owned(),
        crate::identity::csrf_origin_guard,
    ));
    let first = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/register",
            serde_json::json!({ "email": "member@example.test", "password": "a secure long password" }),
        ))
        .await
        .expect("first registration should respond");
    let first_body = to_bytes(first.into_body(), 1024)
        .await
        .expect("response should fit")
        .to_vec();
    let first_token = receiver
        .recv()
        .await
        .expect("first registration should send mail")
        .body
        .split("?token=")
        .nth(1)
        .expect("mail should contain a token")
        .trim()
        .to_owned();

    let duplicate = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/register",
            serde_json::json!({ "email": "MEMBER@example.test", "password": "another secure password" }),
        ))
        .await
        .expect("duplicate registration should respond");
    assert_eq!(duplicate.status(), StatusCode::ACCEPTED);
    let duplicate_body = to_bytes(duplicate.into_body(), 1024)
        .await
        .expect("response should fit")
        .to_vec();
    assert_eq!(first_body, duplicate_body);
    let second_token = receiver
        .recv()
        .await
        .expect("pending registration should receive replacement mail")
        .body
        .split("?token=")
        .nth(1)
        .expect("replacement email should contain token")
        .trim()
        .to_owned();

    let unverified_login = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/login",
            serde_json::json!({
                "email": "member@example.test",
                "password": "a secure long password"
            }),
        ))
        .await
        .expect("unverified account login should respond");
    assert_eq!(unverified_login.status(), StatusCode::FORBIDDEN);

    let wrong_password = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/login",
            serde_json::json!({
                "email": "member@example.test",
                "password": "definitely the wrong password"
            }),
        ))
        .await
        .expect("wrong password login should respond");
    let unknown_email = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/login",
            serde_json::json!({
                "email": "unknown@example.test",
                "password": "definitely the wrong password"
            }),
        ))
        .await
        .expect("unknown email login should respond");
    assert_eq!(wrong_password.status(), StatusCode::UNAUTHORIZED);
    assert_eq!(unknown_email.status(), StatusCode::UNAUTHORIZED);
    let wrong_error: serde_json::Value = serde_json::from_slice(
        &to_bytes(wrong_password.into_body(), 1024)
            .await
            .expect("error body should fit"),
    )
    .expect("wrong password body should be JSON");
    let unknown_error: serde_json::Value = serde_json::from_slice(
        &to_bytes(unknown_email.into_body(), 1024)
            .await
            .expect("error body should fit"),
    )
    .expect("unknown email body should be JSON");
    assert_eq!(wrong_error["code"], unknown_error["code"]);
    assert_eq!(wrong_error["message"], unknown_error["message"]);

    let old_token = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/verify-email",
            serde_json::json!({ "token": first_token }),
        ))
        .await
        .expect("replaced token should respond");
    assert_eq!(old_token.status(), StatusCode::BAD_REQUEST);
    let current_token = app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/verify-email",
            serde_json::json!({ "token": second_token }),
        ))
        .await
        .expect("replacement token should respond");
    assert_eq!(current_token.status(), StatusCode::NO_CONTENT);

    let verified_duplicate = app
        .oneshot(auth_post(
            "/api/v1/auth/register",
            serde_json::json!({ "email": "member@example.test", "password": "another secure password" }),
        ))
        .await
        .expect("verified duplicate should respond");
    assert_eq!(verified_duplicate.status(), StatusCode::ACCEPTED);
    assert!(
        receiver.try_recv().is_err(),
        "verified accounts should not receive registration mail"
    );
}

/// SMTP 投递失败仍返回通用注册响应，并可通过重发验证邮件恢复。
#[tokio::test]
async fn registration_recovers_after_mail_delivery_failure() {
    let pool = session_database().await;
    let store = AccountStore { pool: pool.clone() };
    store.migrate().await.expect("account schema should apply");
    let (failed_sender, failed_receiver) = tokio::sync::mpsc::channel(1);
    drop(failed_receiver);
    let failed_app = super::routes::router(
        store.clone(),
        std::sync::Arc::new(FakeMailer {
            sender: failed_sender,
        }),
        "http://localhost:5173".to_owned(),
    )
    .layer(middleware::from_fn_with_state(
        "http://localhost:5173".to_owned(),
        crate::identity::csrf_origin_guard,
    ));
    let failed_response = failed_app
        .oneshot(auth_post(
            "/api/v1/auth/register",
            serde_json::json!({
                "email": "recover@example.test",
                "password": "a secure recovery password"
            }),
        ))
        .await
        .expect("failed delivery registration should respond");
    assert_eq!(failed_response.status(), StatusCode::ACCEPTED);
    let token_rows: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM account_action_tokens WHERE purpose = 'verify_email'",
    )
    .fetch_one(&pool)
    .await
    .expect("verification token should remain stored after delivery failure");
    assert_eq!(token_rows, 1);

    let (sender, mut receiver) = tokio::sync::mpsc::channel(2);
    let retry_app = super::routes::router(
        store,
        std::sync::Arc::new(FakeMailer { sender }),
        "http://localhost:5173".to_owned(),
    )
    .layer(middleware::from_fn_with_state(
        "http://localhost:5173".to_owned(),
        crate::identity::csrf_origin_guard,
    ));
    let retried = retry_app
        .clone()
        .oneshot(auth_post(
            "/api/v1/auth/resend-verification",
            serde_json::json!({ "email": "recover@example.test" }),
        ))
        .await
        .expect("verification resend should respond");
    assert_eq!(retried.status(), StatusCode::ACCEPTED);
    let email = receiver
        .recv()
        .await
        .expect("resend should deliver a verification email");
    let token = email
        .body
        .split("?token=")
        .nth(1)
        .expect("resend link should contain token")
        .trim();
    let verified = retry_app
        .oneshot(auth_post(
            "/api/v1/auth/verify-email",
            serde_json::json!({ "token": token }),
        ))
        .await
        .expect("recovered verification should respond");
    assert_eq!(verified.status(), StatusCode::NO_CONTENT);
}

/// 构造带可信 Origin 和本地对端地址的 POST 请求。
fn auth_post(path: &str, payload: serde_json::Value) -> Request<Body> {
    Request::builder()
        .method("POST")
        .uri(path)
        .header(header::CONTENT_TYPE, "application/json")
        .header(header::ORIGIN, "http://localhost:5173")
        .extension(ConnectInfo(
            "127.0.0.1:4000"
                .parse::<std::net::SocketAddr>()
                .expect("test peer address should parse"),
        ))
        .body(Body::from(payload.to_string()))
        .expect("test request should build")
}

/// 建立匿名 session 以验证账号登录时会轮换 session ID。
async fn seed_anonymous_session(session: Session) -> StatusCode {
    if session.insert("preauth", "anonymous").await.is_ok() {
        StatusCode::NO_CONTENT
    } else {
        StatusCode::INTERNAL_SERVER_ERROR
    }
}
