-- Common layer owns the anonymous local identity. Feature modules reference
-- user_id logically and must not declare physical foreign keys to this table.
CREATE TABLE IF NOT EXISTS user_profile (
  user_id TEXT PRIMARY KEY,
  age_mode TEXT NOT NULL CHECK (age_mode IN ('adult', 'child')),
  pin_configured INTEGER NOT NULL DEFAULT 0 CHECK (pin_configured IN (0, 1)),
  pin_hash TEXT,
  non_medical_accepted INTEGER NOT NULL DEFAULT 0 CHECK (non_medical_accepted IN (0, 1)),
  default_voice_id TEXT,
  default_avatar_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (pin_configured = (pin_hash IS NOT NULL))
);
