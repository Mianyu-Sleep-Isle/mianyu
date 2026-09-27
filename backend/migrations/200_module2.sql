PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS sleep_plan (
  plan_id TEXT PRIMARY KEY, user_id TEXT NOT NULL,
  input_mode TEXT NOT NULL CHECK (input_mode IN ('choices','sentence')),
  mood TEXT NOT NULL CHECK (mood IN ('calm','annoyed','tired')),
  voice_preference TEXT NOT NULL CHECK (voice_preference IN ('wanted','either','avoid')),
  avoid_tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(avoid_tags_json) AND json_type(avoid_tags_json)='array'),
  selected_content_ids_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(selected_content_ids_json) AND json_type(selected_content_ids_json)='array'),
  plan_type TEXT NOT NULL CHECK (plan_type IN ('soundscape','story','breath','mix')),
  reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 200),
  planned_duration_sec INTEGER NOT NULL CHECK (planned_duration_sec > 0),
  fade_out_sec INTEGER NOT NULL CHECK (fade_out_sec >= 0 AND fade_out_sec <= planned_duration_sec),
  source TEXT NOT NULL CHECK (source IN ('rule','llm')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','started','completed','cancelled')),
  user_modified INTEGER NOT NULL DEFAULT 0 CHECK (user_modified IN (0,1)),
  started_session_id TEXT, created_at TEXT NOT NULL, confirmed_at TEXT, started_at TEXT, completed_at TEXT, cancelled_at TEXT,
  CHECK (status <> 'draft' OR confirmed_at IS NULL), CHECK (status <> 'started' OR started_session_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_sleep_plan_user_status_created ON sleep_plan(user_id,status,created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sleep_plan_started_session ON sleep_plan(started_session_id) WHERE started_session_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS sleep_plan_track (
  track_id TEXT PRIMARY KEY, plan_id TEXT NOT NULL, content_id TEXT NOT NULL,
  content_kind TEXT NOT NULL CHECK (content_kind IN ('audio','story','breath')),
  start_offset_sec INTEGER NOT NULL DEFAULT 0 CHECK (start_offset_sec >= 0),
  volume REAL NOT NULL DEFAULT 1 CHECK (volume BETWEEN 0 AND 1),
  loop_mode TEXT NOT NULL DEFAULT 'once' CHECK (loop_mode IN ('once','loop')),
  sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
  FOREIGN KEY(plan_id) REFERENCES sleep_plan(plan_id) ON DELETE CASCADE, UNIQUE(plan_id,sequence_no)
);
CREATE INDEX IF NOT EXISTS idx_sleep_plan_track_content ON sleep_plan_track(content_id);
CREATE TABLE IF NOT EXISTS story_config (
  story_config_id TEXT PRIMARY KEY, plan_id TEXT NOT NULL UNIQUE, content_id TEXT NOT NULL,
  speech_rate REAL NOT NULL DEFAULT 1 CHECK (speech_rate BETWEEN .5 AND 1.5), duration_sec INTEGER NOT NULL CHECK (duration_sec > 0),
  ending_mode TEXT NOT NULL DEFAULT 'environment_only_then_fade' CHECK (ending_mode='environment_only_then_fade'),
  FOREIGN KEY(plan_id) REFERENCES sleep_plan(plan_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS breath_config (
  breath_config_id TEXT PRIMARY KEY, plan_id TEXT NOT NULL UNIQUE, content_id TEXT NOT NULL, breath_type TEXT NOT NULL,
  inhale_sec INTEGER NOT NULL CHECK (inhale_sec > 0), hold_sec INTEGER NOT NULL DEFAULT 0 CHECK (hold_sec >= 0),
  exhale_sec INTEGER NOT NULL CHECK (exhale_sec > 0), cycle_count INTEGER NOT NULL CHECK (cycle_count > 0),
  duration_sec INTEGER NOT NULL CHECK (duration_sec=(inhale_sec+hold_sec+exhale_sec)*cycle_count),
  FOREIGN KEY(plan_id) REFERENCES sleep_plan(plan_id) ON DELETE CASCADE
);
