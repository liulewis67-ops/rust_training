CREATE TABLE IF NOT EXISTS auth_schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY,
    email_normalized TEXT NOT NULL UNIQUE,
    email_display TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified_at INTEGER,
    password_changed_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS account_action_tokens (
    token_hash TEXT PRIMARY KEY,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    expires_at INTEGER NOT NULL,
    consumed_at INTEGER,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS account_action_tokens_account_purpose_idx
    ON account_action_tokens (account_id, purpose, created_at DESC);
CREATE INDEX IF NOT EXISTS account_action_tokens_expiry_idx
    ON account_action_tokens (expires_at);

CREATE TABLE IF NOT EXISTS auth_rate_limits (
    key_hash TEXT PRIMARY KEY,
    window_started_at INTEGER NOT NULL,
    hit_count INTEGER NOT NULL CHECK (hit_count > 0),
    expires_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_rate_limits_expiry_idx
    ON auth_rate_limits (expires_at);
