ALTER TABLE learning_events
    ADD COLUMN is_study_activity INTEGER NOT NULL DEFAULT 1
    CHECK (is_study_activity IN (0, 1));
