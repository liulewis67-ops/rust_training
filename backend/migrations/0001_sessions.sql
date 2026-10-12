CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_sessions_expiry_date_idx
    ON auth_sessions (expiry_date);
