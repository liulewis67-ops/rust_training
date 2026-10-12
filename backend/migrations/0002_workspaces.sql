CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    template_version TEXT NOT NULL,
    content TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    updated_at INTEGER NOT NULL,
    UNIQUE (owner_id, lesson_id, item_id, template_version)
);

CREATE INDEX IF NOT EXISTS workspaces_owner_updated_idx
    ON workspaces (owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS workspace_conflicts (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    owner_id TEXT NOT NULL,
    submitted_revision INTEGER NOT NULL CHECK (submitted_revision > 0),
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS workspace_conflicts_owner_created_idx
    ON workspace_conflicts (owner_id, workspace_id, created_at DESC);
