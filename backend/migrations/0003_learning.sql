CREATE TABLE IF NOT EXISTS learning_profiles (
    owner_id TEXT PRIMARY KEY,
    time_zone TEXT NOT NULL,
    current_lesson TEXT NOT NULL,
    current_position_at TEXT NOT NULL,
    revision INTEGER NOT NULL CHECK (revision > 0),
    updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_completed_lessons (
    owner_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS learning_reflections (
    owner_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    content TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS learning_self_assessments (
    owner_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (owner_id, lesson_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS learning_study_days (
    owner_id TEXT NOT NULL,
    study_date TEXT NOT NULL,
    PRIMARY KEY (owner_id, study_date)
);

CREATE TABLE IF NOT EXISTS learning_events (
    owner_id TEXT NOT NULL,
    event_id TEXT NOT NULL,
    study_date TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    PRIMARY KEY (owner_id, event_id)
);

CREATE INDEX IF NOT EXISTS learning_events_owner_created_idx
    ON learning_events (owner_id, created_at DESC);
