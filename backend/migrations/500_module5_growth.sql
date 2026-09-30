-- Module 5 owns feedback, preferences and points. user_id and session_id are
-- logical references checked through the common user directory and module 4 facts.
CREATE TABLE IF NOT EXISTS morning_feedback (
  feedback_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  fall_asleep_ease TEXT NOT NULL CHECK (fall_asleep_ease IN ('easy', 'normal', 'difficult', 'unknown')),
  sound_comfort TEXT NOT NULL CHECK (sound_comfort IN ('comfortable', 'acceptable', 'uncomfortable')),
  voice_next_time TEXT NOT NULL CHECK (voice_next_time IN ('want', 'avoid', 'unspecified')),
  story_effect_rating INTEGER CHECK (story_effect_rating BETWEEN 1 AND 5),
  disliked_content TEXT CHECK (length(disliked_content) <= 500),
  note TEXT CHECK (length(note) <= 500),
  record_source TEXT NOT NULL DEFAULT 'subjective_feedback' CHECK (record_source = 'subjective_feedback'),
  submitted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_feedback_user_submitted ON morning_feedback(user_id, submitted_at DESC);

CREATE TABLE IF NOT EXISTS preference_profile (
  profile_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  voice_preference TEXT NOT NULL DEFAULT 'unspecified' CHECK (voice_preference IN ('want', 'avoid', 'unspecified')),
  preferred_voice_id TEXT,
  last_feedback_id TEXT REFERENCES morning_feedback(feedback_id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preference_forbidden_sound_tag (
  user_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  source_feedback_id TEXT REFERENCES morning_feedback(feedback_id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, tag)
);

CREATE TABLE IF NOT EXISTS preference_story_theme (
  user_id TEXT NOT NULL,
  theme TEXT NOT NULL,
  source_feedback_id TEXT REFERENCES morning_feedback(feedback_id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, theme)
);

CREATE TABLE IF NOT EXISTS preference_breath_template (
  user_id TEXT NOT NULL,
  template_id TEXT NOT NULL,
  source_feedback_id TEXT REFERENCES morning_feedback(feedback_id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, template_id)
);

CREATE TABLE IF NOT EXISTS preference_scene (
  user_id TEXT NOT NULL,
  scene_id TEXT NOT NULL,
  source_feedback_id TEXT REFERENCES morning_feedback(feedback_id) ON DELETE SET NULL,
  PRIMARY KEY (user_id, scene_id)
);

CREATE TABLE IF NOT EXISTS points_ledger (
  ledger_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('plan_started', 'feedback_submitted', 'knowledge_completed')),
  points_delta INTEGER NOT NULL CHECK (points_delta > 0),
  source_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  occurred_at TEXT NOT NULL,
  remark TEXT NOT NULL,
  UNIQUE (user_id, event_type, source_id)
);
CREATE INDEX IF NOT EXISTS idx_points_user_time ON points_ledger(user_id, occurred_at DESC);
