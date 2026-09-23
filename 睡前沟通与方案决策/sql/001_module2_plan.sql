-- 模块：模块2 睡前沟通与方案决策
-- 引擎：SQLite 3
-- 口径：主键使用 TEXT UUID；模块内使用物理外键；跨模块只保存 UUID，由 Port 校验
-- 建表顺序：sleep_plan -> plan_track / story_config / breath_config

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS sleep_plan (
    plan_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    plan_type TEXT NOT NULL CHECK (plan_type IN ('soundscape', 'story', 'breath', 'mix')),
    reason TEXT NOT NULL CHECK (length(trim(reason)) BETWEEN 1 AND 200),
    duration_min INTEGER NOT NULL CHECK (duration_min > 0),
    fade_out_min INTEGER NOT NULL CHECK (fade_out_min >= 0 AND fade_out_min <= duration_min),
    source TEXT NOT NULL CHECK (source IN ('rule', 'llm')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'cancelled')),
    user_modified INTEGER NOT NULL DEFAULT 0 CHECK (user_modified IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    confirmed_at TEXT,
    CHECK ((status = 'confirmed' AND confirmed_at IS NOT NULL) OR (status <> 'confirmed' AND confirmed_at IS NULL)),
    CHECK (confirmed_at IS NULL OR confirmed_at >= created_at)
);

CREATE INDEX IF NOT EXISTS idx_sleep_plan_user_status_created ON sleep_plan (user_id, status, created_at);

CREATE TABLE IF NOT EXISTS plan_track (
    plan_track_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL,
    asset_id TEXT NOT NULL,
    volume REAL NOT NULL DEFAULT 1.0 CHECK (volume >= 0.0 AND volume <= 1.0),
    pan REAL NOT NULL DEFAULT 0.0 CHECK (pan >= -1.0 AND pan <= 1.0),
    distance REAL NOT NULL DEFAULT 0.0 CHECK (distance >= 0.0 AND distance <= 1.0),
    indoor_or_outdoor TEXT NOT NULL CHECK (indoor_or_outdoor IN ('indoor', 'outdoor')),
    sequence_no INTEGER NOT NULL CHECK (sequence_no > 0),
    FOREIGN KEY (plan_id) REFERENCES sleep_plan(plan_id) ON DELETE CASCADE,
    UNIQUE (plan_id, sequence_no)
);

CREATE INDEX IF NOT EXISTS idx_plan_track_asset ON plan_track (asset_id);

CREATE TABLE IF NOT EXISTS story_config (
    story_config_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL UNIQUE,
    story_id TEXT NOT NULL,
    theme TEXT NOT NULL,
    tone TEXT NOT NULL,
    speech_rate REAL NOT NULL DEFAULT 1.0 CHECK (speech_rate >= 0.5 AND speech_rate <= 1.5),
    duration_min INTEGER NOT NULL CHECK (duration_min > 0),
    ending_mode TEXT NOT NULL DEFAULT 'environment_only_then_fade' CHECK (ending_mode = 'environment_only_then_fade'),
    FOREIGN KEY (plan_id) REFERENCES sleep_plan(plan_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_story_config_story ON story_config (story_id);

CREATE TABLE IF NOT EXISTS breath_config (
    breath_config_id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL UNIQUE,
    breath_id TEXT NOT NULL,
    breath_type TEXT NOT NULL,
    inhale_sec INTEGER NOT NULL CHECK (inhale_sec > 0),
    hold_sec INTEGER NOT NULL DEFAULT 0 CHECK (hold_sec >= 0),
    exhale_sec INTEGER NOT NULL CHECK (exhale_sec > 0),
    cycle_count INTEGER NOT NULL CHECK (cycle_count > 0),
    duration_sec INTEGER NOT NULL CHECK (duration_sec = (inhale_sec + hold_sec + exhale_sec) * cycle_count),
    FOREIGN KEY (plan_id) REFERENCES sleep_plan(plan_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_breath_config_breath ON breath_config (breath_id);

