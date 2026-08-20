-- Trinity Diagnosis conversion funnel
-- Anonymous event tracking only: no birthdate, diagnosis result, IP, or user profile data.
CREATE TABLE IF NOT EXISTS trinity_funnel_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id  TEXT NOT NULL,
  event_name  TEXT NOT NULL,
  source      TEXT,
  medium      TEXT,
  campaign    TEXT,
  path        TEXT NOT NULL DEFAULT '/trinity',
  created_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trinity_funnel_event_time
  ON trinity_funnel_events(event_name, created_at);

CREATE INDEX IF NOT EXISTS idx_trinity_funnel_session_time
  ON trinity_funnel_events(session_id, created_at);
