PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS scene_config (
  scene_config_id TEXT PRIMARY KEY,
  scene_family_id TEXT NOT NULL,
  config_version INTEGER NOT NULL CHECK (config_version >= 1),
  previous_version_id TEXT,
  user_id TEXT NOT NULL,
  source_plan_id TEXT,
  preset_scene_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'handed_off', 'retired')),
  space_type TEXT NOT NULL CHECK (space_type IN ('indoor', 'outdoor')),
  environment_type TEXT NOT NULL CHECK (length(trim(environment_type)) BETWEEN 1 AND 64),
  reverb_type TEXT NOT NULL CHECK (length(trim(reverb_type)) BETWEEN 1 AND 64),
  handed_off_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (previous_version_id IS NULL OR previous_version_id <> scene_config_id),
  CHECK (status <> 'handed_off' OR handed_off_at IS NOT NULL),
  CHECK (source_plan_id IS NULL OR preset_scene_id IS NULL),
  FOREIGN KEY (previous_version_id) REFERENCES scene_config (scene_config_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_scene_config_family_version
  ON scene_config (scene_family_id, config_version);
CREATE INDEX IF NOT EXISTS idx_scene_config_user_status
  ON scene_config (user_id, status, updated_at);

CREATE TABLE IF NOT EXISTS scene_audio_source (
  source_id TEXT PRIMARY KEY,
  scene_config_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  space_type TEXT NOT NULL CHECK (space_type IN ('indoor', 'outdoor')),
  volume REAL NOT NULL CHECK (volume BETWEEN 0 AND 1),
  loop_mode TEXT NOT NULL CHECK (loop_mode IN ('once', 'loop', 'intermittent')),
  fade_in_sec INTEGER NOT NULL CHECK (fade_in_sec >= 0),
  fade_out_sec INTEGER NOT NULL CHECK (fade_out_sec >= 0),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  UNIQUE (scene_config_id, source_id),
  FOREIGN KEY (scene_config_id) REFERENCES scene_config (scene_config_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scene_audio_source_asset
  ON scene_audio_source (asset_id);

CREATE TABLE IF NOT EXISTS scene_element (
  element_id TEXT PRIMARY KEY,
  scene_config_id TEXT NOT NULL,
  client_element_id TEXT NOT NULL CHECK (length(trim(client_element_id)) BETWEEN 1 AND 64),
  asset_id TEXT NOT NULL,
  source_id TEXT,
  space_type TEXT NOT NULL CHECK (space_type IN ('indoor', 'outdoor')),
  position_x REAL NOT NULL CHECK (position_x BETWEEN 0 AND 1),
  position_y REAL NOT NULL CHECK (position_y BETWEEN 0 AND 1),
  scale REAL NOT NULL CHECK (scale > 0),
  z_order INTEGER NOT NULL CHECK (z_order >= 0),
  UNIQUE (scene_config_id, client_element_id),
  FOREIGN KEY (scene_config_id) REFERENCES scene_config (scene_config_id) ON DELETE CASCADE,
  FOREIGN KEY (scene_config_id, source_id) REFERENCES scene_audio_source (scene_config_id, source_id)
);

CREATE INDEX IF NOT EXISTS idx_scene_element_asset
  ON scene_element (asset_id);
