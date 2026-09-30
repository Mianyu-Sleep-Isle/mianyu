-- Module 1 placeholder: the catalog itself is a versioned manifest in code
-- until member 1 delivers the content service; only user favorites persist.
CREATE TABLE IF NOT EXISTS content_favorite (
  user_id TEXT NOT NULL,
  content_id TEXT NOT NULL CHECK (length(trim(content_id)) BETWEEN 1 AND 64),
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_id, content_id)
);
