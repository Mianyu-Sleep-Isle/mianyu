-- Accounts own a username or phone and a hashed password. The user_id they
-- resolve to is the same anonymous-shaped row in user_profile, so existing
-- feature modules keep working unchanged.
CREATE TABLE IF NOT EXISTS account (
  account_id TEXT PRIMARY KEY,
  username TEXT UNIQUE,
  phone TEXT UNIQUE,
  password_hash TEXT NOT NULL,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK ((username IS NOT NULL) OR (phone IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_username ON account(lower(username)) WHERE username IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_account_phone ON account(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_account_user_id ON account(user_id);
