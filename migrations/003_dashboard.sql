-- ACE Dashboard: チェック状態保存テーブル（既存DBに追加）
CREATE TABLE IF NOT EXISTS ace_checked (
  user_id    TEXT NOT NULL,
  slot_id    TEXT NOT NULL,
  xp         INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, slot_id)
);
