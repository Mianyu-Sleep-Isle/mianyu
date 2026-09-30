-- Module 4 owns these three tables. References to plans, scenes and users are
-- logical references checked through their public query ports.
CREATE TABLE IF NOT EXISTS sleep_session (
  session_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  plan_id TEXT NOT NULL,
  scene_config_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing','running','paused','completed','cancelled','failed')),
  current_stage TEXT CHECK (current_stage IS NULL OR current_stage IN ('breath','story','soundscape','fade_out')),
  planned_duration_sec INTEGER NOT NULL CHECK (planned_duration_sec BETWEEN 1 AND 43200),
  fade_out_sec INTEGER NOT NULL CHECK (fade_out_sec BETWEEN 0 AND 1800 AND fade_out_sec <= planned_duration_sec),
  started_at TEXT,
  ended_at TEXT,
  active_playback_sec INTEGER NOT NULL DEFAULT 0 CHECK (active_playback_sec >= 0),
  paused_sec INTEGER NOT NULL DEFAULT 0 CHECK (paused_sec >= 0),
  stop_reason TEXT CHECK (stop_reason IS NULL OR stop_reason IN ('timer_completed','user_ended','user_cancelled_before_start','app_interrupted','audio_engine_error','resource_load_failed','validation_failed')),
  master_volume_start REAL NOT NULL CHECK (master_volume_start BETWEEN 0 AND 1),
  master_volume_end REAL CHECK (master_volume_end IS NULL OR master_volume_end BETWEEN 0 AND 1),
  noise_capture_authorized INTEGER NOT NULL DEFAULT 0 CHECK (noise_capture_authorized IN (0,1)),
  device_data_authorized INTEGER NOT NULL DEFAULT 0 CHECK (device_data_authorized IN (0,1)),
  record_source TEXT NOT NULL DEFAULT 'playback_record' CHECK (record_source = 'playback_record'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at),
  CHECK ((status IN ('completed','cancelled','failed') AND ended_at IS NOT NULL AND stop_reason IS NOT NULL)
      OR (status IN ('preparing','running','paused') AND ended_at IS NULL AND stop_reason IS NULL)),
  CHECK (status <> 'completed' OR (started_at IS NOT NULL AND stop_reason = 'timer_completed')),
  CHECK (status <> 'cancelled' OR stop_reason IN ('user_ended','user_cancelled_before_start')),
  CHECK (status <> 'failed' OR stop_reason IN ('app_interrupted','audio_engine_error','resource_load_failed','validation_failed'))
);
CREATE INDEX IF NOT EXISTS idx_sleep_session_user_started ON sleep_session(user_id,started_at);
CREATE INDEX IF NOT EXISTS idx_sleep_session_user_status ON sleep_session(user_id,status);
CREATE INDEX IF NOT EXISTS idx_sleep_session_plan ON sleep_session(plan_id);
CREATE INDEX IF NOT EXISTS idx_sleep_session_scene ON sleep_session(scene_config_id);

CREATE TABLE IF NOT EXISTS playback_stage (
  stage_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sleep_session(session_id) ON DELETE CASCADE,
  stage_type TEXT NOT NULL CHECK (stage_type IN ('breath','story','soundscape','fade_out')),
  sequence_no INTEGER NOT NULL CHECK (sequence_no >= 1),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','paused','completed','skipped','failed')),
  planned_duration_sec INTEGER CHECK (planned_duration_sec IS NULL OR planned_duration_sec > 0),
  actual_duration_sec INTEGER NOT NULL DEFAULT 0 CHECK (actual_duration_sec >= 0),
  started_at TEXT,
  ended_at TEXT,
  skip_reason TEXT CHECK (skip_reason IS NULL OR length(skip_reason) BETWEEN 1 AND 100),
  record_source TEXT NOT NULL DEFAULT 'playback_record' CHECK (record_source = 'playback_record'),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(session_id,sequence_no),
  UNIQUE(session_id,stage_type),
  UNIQUE(stage_id,session_id),
  CHECK (ended_at IS NULL OR started_at IS NULL OR ended_at >= started_at),
  CHECK (status <> 'pending' OR (started_at IS NULL AND ended_at IS NULL)),
  CHECK (status <> 'completed' OR (started_at IS NOT NULL AND ended_at IS NOT NULL)),
  CHECK (status <> 'skipped' OR (skip_reason IS NOT NULL AND ended_at IS NOT NULL AND actual_duration_sec = 0))
);
CREATE INDEX IF NOT EXISTS idx_playback_stage_session_status ON playback_stage(session_id,status);

CREATE TABLE IF NOT EXISTS playback_event (
  event_id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sleep_session(session_id) ON DELETE CASCADE,
  stage_id TEXT,
  scene_audio_source_id TEXT,
  event_type TEXT NOT NULL CHECK (event_type IN ('session_preparing','session_started','stage_started','stage_completed','stage_skipped','paused','resumed','track_started','track_stopped','volume_changed','story_finished','voice_removed','fade_started','fade_completed','session_ended','resource_missing','playback_error')),
  occurred_at TEXT NOT NULL,
  old_value TEXT CHECK (old_value IS NULL OR length(old_value) <= 200),
  new_value TEXT CHECK (new_value IS NULL OR length(new_value) <= 200),
  error_code TEXT CHECK (error_code IS NULL OR length(error_code) <= 50),
  detail_json TEXT CHECK (detail_json IS NULL OR json_valid(detail_json)),
  record_source TEXT NOT NULL DEFAULT 'playback_record' CHECK (record_source = 'playback_record'),
  created_at TEXT NOT NULL,
  FOREIGN KEY(stage_id,session_id) REFERENCES playback_stage(stage_id,session_id) ON DELETE CASCADE,
  CHECK (event_type NOT IN ('resource_missing','playback_error') OR error_code IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_playback_event_session_time ON playback_event(session_id,occurred_at,event_id);
CREATE INDEX IF NOT EXISTS idx_playback_event_scene_source ON playback_event(scene_audio_source_id,occurred_at);
CREATE INDEX IF NOT EXISTS idx_playback_event_stage_time ON playback_event(stage_id,occurred_at);

CREATE TRIGGER IF NOT EXISTS playback_event_no_update
BEFORE UPDATE ON playback_event BEGIN SELECT RAISE(ABORT,'playback_event is append-only'); END;
CREATE TRIGGER IF NOT EXISTS playback_event_no_delete
BEFORE DELETE ON playback_event
WHEN EXISTS (SELECT 1 FROM sleep_session WHERE session_id=OLD.session_id)
BEGIN SELECT RAISE(ABORT,'playback_event is append-only'); END;
