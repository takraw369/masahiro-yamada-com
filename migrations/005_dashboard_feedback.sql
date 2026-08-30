CREATE TABLE IF NOT EXISTS dashboard_feedback (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT NOT NULL DEFAULT 'masa',
  page       TEXT NOT NULL DEFAULT '/dashboard',
  message    TEXT NOT NULL,
  context    TEXT,
  status     TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
