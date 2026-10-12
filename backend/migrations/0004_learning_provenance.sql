ALTER TABLE learning_self_assessments
    ADD COLUMN source TEXT NOT NULL DEFAULT 'learner_reported'
    CHECK (source IN ('learner_reported', 'legacy_self_reported'));
