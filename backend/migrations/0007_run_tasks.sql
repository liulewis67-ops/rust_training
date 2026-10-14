CREATE TABLE IF NOT EXISTS run_tasks (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    workspace_id TEXT NOT NULL,
    workspace_revision INTEGER NOT NULL CHECK (workspace_revision > 0),
    idempotency_key TEXT NOT NULL,
    request_hash TEXT NOT NULL,
    source_hash TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('run')),
    source_snapshot TEXT NOT NULL,
    stdin TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
    created_at INTEGER NOT NULL,
    UNIQUE (owner_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS run_tasks_owner_created_idx
    ON run_tasks (owner_id, created_at DESC, id DESC);
