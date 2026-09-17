-- 模块3 M0：梦境空间三表
-- 引擎：SQLite（Flutter 本地库可直接执行）
-- 口径：模块内物理外键；跨模块只存稳定 UUID，由 Port 校验
-- 建表顺序：scene_config → scene_audio_source → scene_element

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS scene_config (
  scene_config_id     TEXT PRIMARY KEY,
  scene_family_id     TEXT NOT NULL,
  previous_version_id TEXT,
  user_id             TEXT NOT NULL,
  scene_name          TEXT NOT NULL CHECK (length(trim(scene_name)) BETWEEN 1 AND 100),
  space_type          TEXT NOT NULL DEFAULT 'indoor'
                      CHECK (space_type IN ('indoor', 'outdoor')),
  environment_type    TEXT NOT NULL DEFAULT 'bedroom'
                      CHECK (environment_type IN ('bedroom', 'rain_courtyard', 'other')),
  reverb_type         TEXT NOT NULL DEFAULT 'indoor_soft'
                      CHECK (reverb_type IN ('none', 'indoor_soft', 'outdoor_open')),
  bed_x               REAL NOT NULL DEFAULT 0.50000
                      CHECK (bed_x >= 0.00000 AND bed_x <= 1.00000),
  bed_y               REAL NOT NULL DEFAULT 0.75000
                      CHECK (bed_y >= 0.00000 AND bed_y <= 1.00000),
  source_plan_id      TEXT,
  creation_method     TEXT NOT NULL
                      CHECK (creation_method IN (
                        'preset', 'plan_generated', 'user_created', 'copied', 'imported'
                      )),
  config_version      INTEGER NOT NULL DEFAULT 1 CHECK (config_version >= 1),
  lifecycle_status    TEXT NOT NULL DEFAULT 'draft'
                      CHECK (lifecycle_status IN ('draft', 'handed_off', 'retired')),
  handed_off_at       TEXT,
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  CHECK (previous_version_id IS NULL OR previous_version_id <> scene_config_id),
  CHECK (
    (lifecycle_status = 'draft' AND handed_off_at IS NULL)
    OR (lifecycle_status IN ('handed_off', 'retired') AND handed_off_at IS NOT NULL)
  ),
  CHECK (updated_at >= created_at),
  UNIQUE (scene_family_id, config_version),
  FOREIGN KEY (previous_version_id) REFERENCES scene_config (scene_config_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scene_config_previous_version
  ON scene_config (previous_version_id)
  WHERE previous_version_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scene_config_user_status_updated
  ON scene_config (user_id, lifecycle_status, updated_at);

CREATE INDEX IF NOT EXISTS idx_scene_config_source_plan
  ON scene_config (source_plan_id)
  WHERE source_plan_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS scene_audio_source (
  source_id        TEXT PRIMARY KEY,
  scene_config_id  TEXT NOT NULL,
  asset_id         TEXT NOT NULL,
  space_type       TEXT NOT NULL DEFAULT 'indoor'
                   CHECK (space_type IN ('indoor', 'outdoor')),
  position_x       REAL NOT NULL DEFAULT 0.50000
                   CHECK (position_x >= 0.00000 AND position_x <= 1.00000),
  position_y       REAL NOT NULL DEFAULT 0.50000
                   CHECK (position_y >= 0.00000 AND position_y <= 1.00000),
  base_volume      REAL NOT NULL DEFAULT 0.500
                   CHECK (base_volume >= 0.000 AND base_volume <= 1.000),
  pan              REAL NOT NULL DEFAULT 0.000
                   CHECK (pan >= -1.000 AND pan <= 1.000),
  distance         REAL NOT NULL DEFAULT 0.000
                   CHECK (distance >= 0.000 AND distance <= 1.000),
  loop_mode        TEXT NOT NULL DEFAULT 'loop'
                   CHECK (loop_mode IN ('once', 'loop', 'interval')),
  interval_sec     INTEGER,
  fade_in_sec      INTEGER NOT NULL DEFAULT 0 CHECK (fade_in_sec >= 0),
  fade_out_sec     INTEGER NOT NULL DEFAULT 0 CHECK (fade_out_sec >= 0),
  enabled          INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  CHECK (
    (loop_mode = 'interval' AND interval_sec IS NOT NULL AND interval_sec > 0)
    OR (loop_mode <> 'interval' AND interval_sec IS NULL)
  ),
  UNIQUE (source_id, scene_config_id),
  FOREIGN KEY (scene_config_id) REFERENCES scene_config (scene_config_id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scene_audio_space_enabled
  ON scene_audio_source (scene_config_id, space_type, enabled);

CREATE INDEX IF NOT EXISTS idx_scene_audio_asset
  ON scene_audio_source (asset_id);

CREATE TABLE IF NOT EXISTS scene_element (
  element_id       TEXT PRIMARY KEY,
  scene_config_id  TEXT NOT NULL,
  element_name     TEXT NOT NULL CHECK (length(trim(element_name)) BETWEEN 1 AND 100),
  element_type     TEXT NOT NULL CHECK (length(trim(element_type)) BETWEEN 1 AND 50),
  position_x       REAL NOT NULL DEFAULT 0.50000
                   CHECK (position_x >= 0.00000 AND position_x <= 1.00000),
  position_y       REAL NOT NULL DEFAULT 0.50000
                   CHECK (position_y >= 0.00000 AND position_y <= 1.00000),
  space_type       TEXT NOT NULL DEFAULT 'indoor'
                   CHECK (space_type IN ('indoor', 'outdoor')),
  z_order          INTEGER NOT NULL DEFAULT 0 CHECK (z_order >= 0),
  bound_source_id  TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (element_id, scene_config_id),
  FOREIGN KEY (scene_config_id) REFERENCES scene_config (scene_config_id)
    ON DELETE CASCADE,
  FOREIGN KEY (bound_source_id, scene_config_id)
    REFERENCES scene_audio_source (source_id, scene_config_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_scene_element_bound_source
  ON scene_element (bound_source_id)
  WHERE bound_source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_scene_element_space_z
  ON scene_element (scene_config_id, space_type, z_order);
