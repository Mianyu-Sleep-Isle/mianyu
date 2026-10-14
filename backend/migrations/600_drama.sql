PRAGMA foreign_keys = ON;

CREATE TABLE drama_job (
  job_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued','running','cancelling','completed','failed','cancelled')),
  stage TEXT CHECK (stage IN (
    'generating_story','reviewing','generating_storyboard','generating_character_reference',
    'generating_images','synthesizing_voice','composing_video'
  )),
  stage_detail TEXT CHECK (stage_detail IN ('waiting_gpu','loading_model','running','retrying') OR stage_detail IS NULL),
  failed_stage TEXT,
  brief_json TEXT NOT NULL CHECK (json_valid(brief_json)),
  title TEXT,
  summary TEXT,
  narration TEXT,
  story_source TEXT CHECK (story_source IN ('llm','template') OR story_source IS NULL),
  review_status TEXT NOT NULL DEFAULT 'pending' CHECK (review_status IN ('pending','approved','rejected')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  notices_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(notices_json)),
  error_code TEXT,
  error_message TEXT,
  error_retryable INTEGER CHECK (error_retryable IN (0,1) OR error_retryable IS NULL),
  manual_retry_count INTEGER NOT NULL DEFAULT 0 CHECK (manual_retry_count BETWEEN 0 AND 3),
  seed INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT,
  video_duration_sec REAL,
  video_size_bytes INTEGER
);
CREATE INDEX idx_drama_job_user_created ON drama_job(user_id, created_at DESC);
CREATE INDEX idx_drama_job_status_created ON drama_job(status, created_at);

CREATE TABLE drama_stage (
  job_id TEXT NOT NULL,
  stage_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','running','completed','failed','skipped')),
  attempt INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  finished_at TEXT,
  PRIMARY KEY (job_id, stage_key),
  FOREIGN KEY (job_id) REFERENCES drama_job(job_id) ON DELETE CASCADE
);

CREATE TABLE drama_shot (
  job_id TEXT NOT NULL,
  shot_order INTEGER NOT NULL CHECK (shot_order BETWEEN 1 AND 8),
  duration_sec REAL NOT NULL CHECK (duration_sec > 0),
  narration_text TEXT NOT NULL,
  image_prompt TEXT NOT NULL,
  negative_prompt TEXT NOT NULL,
  transition TEXT NOT NULL CHECK (transition IN ('fade','crossfade')),
  camera_motion TEXT NOT NULL CHECK (camera_motion IN ('static','zoom_in','zoom_out','pan')),
  seed INTEGER NOT NULL,
  image_status TEXT NOT NULL CHECK (image_status IN ('pending','generating','completed','failed')),
  audio_status TEXT NOT NULL CHECK (audio_status IN ('pending','generating','completed','failed')),
  PRIMARY KEY (job_id, shot_order),
  FOREIGN KEY (job_id) REFERENCES drama_job(job_id) ON DELETE CASCADE
);

CREATE TABLE drama_idempotency (
  user_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  job_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, idempotency_key),
  FOREIGN KEY (job_id) REFERENCES drama_job(job_id) ON DELETE CASCADE
);

CREATE TABLE drama_gpu_lock (
  lock_id INTEGER PRIMARY KEY CHECK (lock_id = 1),
  job_id TEXT,
  stage TEXT,
  heartbeat_at TEXT
);
INSERT INTO drama_gpu_lock(lock_id, job_id, stage, heartbeat_at) VALUES (1, NULL, NULL, NULL);
