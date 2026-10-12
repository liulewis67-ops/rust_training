CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    data TEXT NOT NULL,
    expiry_unix INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS auth_sessions_expiry_unix_idx
    ON auth_sessions (expiry_unix);
