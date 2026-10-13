//! 密码哈希和一次性账号令牌原语。

use std::sync::{Arc, OnceLock};

use argon2::{
    Algorithm, Argon2, Params, Version,
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
};
use rand_core::{OsRng, RngCore};
use sha2::{Digest, Sha256};
use tokio::sync::Semaphore;

use super::ValidationError;

const MIN_PASSWORD_CHARS: usize = 12;
const MAX_PASSWORD_CHARS: usize = 128;
const MAX_PASSWORD_BYTES: usize = 512;
const ARGON2_MEMORY_KIB: u32 = 19_456;
const ARGON2_TIME_COST: u32 = 2;
const ARGON2_PARALLELISM: u32 = 1;
const MAX_CONCURRENT_HASHES: usize = 2;

static HASH_SLOTS: OnceLock<Arc<Semaphore>> = OnceLock::new();

/// 校验口令长度并限制 Argon2 接收的最大 UTF-8 字节数。
///
/// # Errors
/// 超出 12–128 Unicode scalar value 或 512 字节范围时返回 `InvalidPassword`。
pub(super) fn validate_password(password: &str) -> Result<(), ValidationError> {
    let char_count = password.chars().count();
    if !(MIN_PASSWORD_CHARS..=MAX_PASSWORD_CHARS).contains(&char_count)
        || password.len() > MAX_PASSWORD_BYTES
    {
        return Err(ValidationError::InvalidPassword);
    }
    Ok(())
}

/// 使用 Argon2id v0x13 为口令生成包含随机 salt 的 PHC 字符串。
///
/// # Errors
/// 随机源、参数、阻塞任务或哈希库失败时返回脱敏 `SecurityError`。
pub(super) async fn hash_password(password: String) -> Result<String, SecurityError> {
    let permit = hash_semaphore()
        .acquire_owned()
        .await
        .map_err(|_| SecurityError::HashUnavailable)?;
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        hash_password_blocking(&password)
    })
    .await
    .map_err(|_| SecurityError::HashUnavailable)?
}

/// 在受限阻塞线程中计算 Argon2id PHC 字符串。
///
/// # Errors
/// 系统随机源或 Argon2 库失败时返回脱敏错误。
fn hash_password_blocking(password: &str) -> Result<String, SecurityError> {
    let mut salt_bytes = [0_u8; 16];
    OsRng
        .try_fill_bytes(&mut salt_bytes)
        .map_err(|_| SecurityError::RandomUnavailable)?;
    let salt = SaltString::encode_b64(&salt_bytes).map_err(|_| SecurityError::HashUnavailable)?;
    let argon2 = configured_argon2()?;
    argon2
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|_| SecurityError::HashUnavailable)
}

/// 在受限阻塞线程中校验口令与 PHC 编码哈希。
///
/// # Errors
/// PHC 编码损坏、阻塞任务或 Argon2 库失败时返回脱敏错误。
pub(super) async fn verify_password(
    password: String,
    encoded_hash: String,
) -> Result<bool, SecurityError> {
    let permit = hash_semaphore()
        .acquire_owned()
        .await
        .map_err(|_| SecurityError::HashUnavailable)?;
    tokio::task::spawn_blocking(move || {
        let _permit = permit;
        let parsed = PasswordHash::new(&encoded_hash).map_err(|_| SecurityError::InvalidHash)?;
        Ok(configured_argon2()?
            .verify_password(password.as_bytes(), &parsed)
            .is_ok())
    })
    .await
    .map_err(|_| SecurityError::HashUnavailable)?
}

/// 使用系统 CSPRNG 生成 256-bit token，并返回其 SHA-256 lowercase hex 摘要。
///
/// # Errors
/// 系统随机源故障时返回 `RandomUnavailable`。
pub(super) fn new_action_token() -> Result<(String, String), SecurityError> {
    let mut token_bytes = [0_u8; 32];
    OsRng
        .try_fill_bytes(&mut token_bytes)
        .map_err(|_| SecurityError::RandomUnavailable)?;
    let token = hex_encode(&token_bytes);
    let digest = Sha256::digest(token.as_bytes());
    Ok((token, hex_encode(&digest)))
}

/// 校验提交的 256 位小写十六进制操作令牌并计算摘要。
///
/// # Errors
/// 令牌不是恰好 64 个 ASCII 十六进制字符时返回 `InvalidToken`。
pub(super) fn digest_action_token(token: &str) -> Result<String, SecurityError> {
    if token.len() != 64 || !token.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return Err(SecurityError::InvalidToken);
    }
    Ok(hex_encode(&Sha256::digest(token.as_bytes())))
}

/// 构造使用固定版本和参数的 Argon2id 实例。
///
/// # Errors
/// 固定参数若被当前库拒绝则返回 `HashUnavailable`。
fn configured_argon2() -> Result<Argon2<'static>, SecurityError> {
    let params = Params::new(
        ARGON2_MEMORY_KIB,
        ARGON2_TIME_COST,
        ARGON2_PARALLELISM,
        None,
    )
    .map_err(|_| SecurityError::HashUnavailable)?;
    Ok(Argon2::new(Algorithm::Argon2id, Version::V0x13, params))
}

/// 返回进程级信号量，限制内存困难型密码运算的并发数。
fn hash_semaphore() -> Arc<Semaphore> {
    Arc::clone(HASH_SLOTS.get_or_init(|| Arc::new(Semaphore::new(MAX_CONCURRENT_HASHES))))
}

/// 将字节编码为适用于不透明 URL 令牌的小写十六进制字符串。
fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        encoded.push(char::from(HEX[usize::from(byte >> 4)]));
        encoded.push(char::from(HEX[usize::from(byte & 0x0f)]));
    }
    encoded
}

/// 安全操作可恢复错误，不包含敏感输入或底层诊断。
#[derive(Debug, PartialEq, Eq)]
pub(super) enum SecurityError {
    RandomUnavailable,
    HashUnavailable,
    InvalidHash,
    InvalidToken,
}
