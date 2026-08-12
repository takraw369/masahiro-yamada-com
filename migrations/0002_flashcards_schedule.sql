-- ── Flashcard Decks ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashcard_decks (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  color       TEXT DEFAULT '#F59E0B',
  sort_order  INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

-- ── Flashcards ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashcards (
  id           TEXT PRIMARY KEY,
  front        TEXT NOT NULL,
  back         TEXT NOT NULL,
  deck_id      TEXT NOT NULL,
  tags         TEXT,
  difficulty   TEXT DEFAULT 'medium',
  next_review  TEXT DEFAULT (date('now')),
  review_count INTEGER DEFAULT 0,
  ease_factor  REAL DEFAULT 2.5,
  interval_days INTEGER DEFAULT 1,
  xp_total     INTEGER DEFAULT 0,
  source       TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

-- ── Flashcard Reviews ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS flashcard_reviews (
  id          TEXT PRIMARY KEY,
  card_id     TEXT NOT NULL,
  rating      TEXT NOT NULL,
  xp_earned   INTEGER DEFAULT 0,
  reviewed_at TEXT DEFAULT (datetime('now'))
);

-- ── Initial Decks ─────────────────────────────────────────
INSERT OR IGNORE INTO flashcard_decks (id, name, description, color, sort_order) VALUES
  ('deck-ace',    'ACE用語',        'ACEメソッドの核心概念',          '#F59E0B', 1),
  ('deck-enemy',  '仮想敵×切り口', '14の仮想敵と5つの切り口',        '#A78BFA', 2),
  ('deck-brain',  '脳科学',         '発信で使う脳科学の知見・データ', '#3B82F6', 3),
  ('deck-layer0', 'Layer 0演習',    '身体感覚で無意識を体感させるワーク', '#22c55e', 4);

-- ── Initial Cards: ACE用語 ─────────────────────────────────
INSERT OR IGNORE INTO flashcards (id, front, back, deck_id, tags) VALUES
  ('c-ace-01', '五蘊（パンチャ・カンダ）', '色(事実)・受(感覚)・想(解釈)・行(反応)・識(意識)。認知の5層構造。ACEのフレームワークの根幹', 'deck-ace', '認知'),
  ('c-ace-02', '予測符号化', '脳は予測装置。予測と事実のズレ＝学習機会。驚きが学習を駆動する', 'deck-ace', '脳科学'),
  ('c-ace-03', 'リアン', 'lien(仏:絆) + เรียน(タイ:学ぶ)。ACEの受講者の呼称', 'deck-ace', '用語'),
  ('c-ace-04', 'Layer 0', '身体感覚で無意識の存在を体感させる導入演習群。AIに代替不可能な核', 'deck-ace', '演習'),
  ('c-ace-05', 'be-do-have螺旋', '在り方→行動→結果。起点は常にbe。haveはbeに付随するがbeはhaveに付随しない', 'deck-ace', '原理'),
  ('c-ace-06', '自己効力感 vs 自尊心', 'efficacy=「できる」確信 / esteem=「自分に価値がある」評価。混同すると崩れる', 'deck-ace', '心理'),
  ('c-ace-07', '惹き出す', '教え込む（押し込む）の対義。ACEの教育哲学の核。答えは外から与えられるものではない', 'deck-ace', '哲学'),
  ('c-ace-08', 'FLOW v2', 'Feel→Lived story→Overwrite→Welcome in。内側から変容を起こす4ステップ', 'deck-ace', 'フレームワーク'),
  ('c-ace-09', 'セロトニン・ベースライン', 'NA/DAループから離脱し安定基盤を構築。興奮ではなく静けさが本番力の土台', 'deck-ace', '脳科学'),
  ('c-ace-10', '結主（ユヌス）', 'Athlete Questの3人ギルド構造。絆と学びの共同体', 'deck-ace', 'コミュニティ');

-- ── Initial Cards: 仮想敵×切り口 ──────────────────────────
INSERT OR IGNORE INTO flashcards (id, front, back, deck_id, tags) VALUES
  ('c-en-01', '「頑張れ」コーチ', '根性論が脳の予測システムを破壊する科学的証拠。慢性ストレス→コルチゾール過剰→前頭前野萎縮', 'deck-enemy', '仮想敵'),
  ('c-en-02', 'メンタル本信者', 'ポジティブシンキングが逆効果になるメカニズム。現実否定→認知歪み→自己効力感崩壊', 'deck-enemy', '仮想敵'),
  ('c-en-03', '才能神話の親', '才能は名詞ではなく動詞。canからbeへの転換。「才能がある」は呪いになる', 'deck-enemy', '仮想敵'),
  ('c-en-04', '目標設定マニア', 'SMART目標がアスリートのbeを殺すプロセス。have起点の目標は持続しない', 'deck-enemy', '仮想敵'),
  ('c-en-05', '結果至上主義コーチ', 'have起点のトレーニングがdoの質を下げる構造。結果への執着が判断を鈍らせる', 'deck-enemy', '仮想敵'),
  ('c-en-06', '比較教育者', '比較三原則: 比べるな→は無理 / 燃やすな / 燃料に変えろ。比較は道具、支配者にさせない', 'deck-enemy', '仮想敵');

-- ── Initial Cards: 脳科学 ──────────────────────────────────
INSERT OR IGNORE INTO flashcards (id, front, back, deck_id, tags) VALUES
  ('c-br-01', '予測誤差', '予測と現実のギャップ。これが学習信号になる。誤差が大きいほど学習効果が高い', 'deck-brain', '基礎'),
  ('c-br-02', 'スコトーマ', '脳の盲点。見えているのに認識されない情報。スマホ待受の色を言えるか？', 'deck-brain', '認知'),
  ('c-br-03', '確認ゾーン', 'コンフォートゾーンの本質。脳が予測を確認できる範囲。安全ではなく「予測可能」なゾーン', 'deck-brain', '認知'),
  ('c-br-04', 'DEL-1 (EDIL3)', '運動が老化細胞を除去する生物学的メカニズム。動くことが細胞をリセットする', 'deck-brain', '身体'),
  ('c-br-05', 'マイオカイン', '筋肉由来ホルモン。運動→脳への化学的フィードバック。筋肉は内分泌器官', 'deck-brain', '身体'),
  ('c-br-06', 'ブロック宇宙論', '過去・現在・未来が同時存在。「未来のbe」がリアルに存在する根拠', 'deck-brain', '哲学');

-- ── Initial Cards: Layer 0演習 ─────────────────────────────
INSERT OR IGNORE INTO flashcards (id, front, back, deck_id, tags) VALUES
  ('c-l0-01', '片足立ち30秒', '目を閉じる→バランス崩壊→「無意識は存在する」を体感させる。意識では制御できない何かがある', 'deck-layer0', '演習'),
  ('c-l0-02', '両腕平行テスト', '目を瞑って両腕を平行に→開眼するとズレている→自己認識と現実のギャップを可視化', 'deck-layer0', '演習'),
  ('c-l0-03', 'スマホ・スコトーマ', 'スマホの待受画像の色を当てる→正解率が低い→「見てるのに見てない」を体感', 'deck-layer0', '演習');

-- ── Schedule Templates ────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_templates (
  id                TEXT PRIMARY KEY,
  title             TEXT NOT NULL,
  category          TEXT NOT NULL,
  color             TEXT,
  estimated_minutes INTEGER DEFAULT 30,
  default_time_slot TEXT,
  platforms         TEXT,
  ai_templates      TEXT,
  xp_multiplier     REAL DEFAULT 1.0,
  recurring         TEXT DEFAULT 'none',
  sort_order        INTEGER DEFAULT 0,
  created_at        TEXT DEFAULT (datetime('now'))
);

-- ── Schedule Items ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_items (
  id                TEXT PRIMARY KEY,
  template_id       TEXT,
  title             TEXT NOT NULL,
  category          TEXT,
  color             TEXT,
  date              TEXT NOT NULL,
  time_slot         TEXT NOT NULL,
  estimated_minutes INTEGER DEFAULT 30,
  platforms         TEXT,
  content           TEXT,
  image_memo        TEXT,
  memo              TEXT,
  status            TEXT DEFAULT 'empty',
  platform_status   TEXT,
  recurring         TEXT DEFAULT 'none',
  completed         INTEGER DEFAULT 0,
  xp_earned         INTEGER DEFAULT 0,
  created_at        TEXT DEFAULT (datetime('now')),
  updated_at        TEXT DEFAULT (datetime('now'))
);

-- ── Schedule Streaks ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_streaks (
  id              TEXT PRIMARY KEY,
  week_start      TEXT NOT NULL UNIQUE,
  total_xp        INTEGER DEFAULT 0,
  target_xp       INTEGER DEFAULT 500,
  items_completed INTEGER DEFAULT 0,
  items_total     INTEGER DEFAULT 0,
  content_posted  INTEGER DEFAULT 0
);

-- ── Initial Schedule Templates ────────────────────────────
INSERT OR IGNORE INTO schedule_templates (id, title, category, color, estimated_minutes, default_time_slot, platforms, ai_templates, xp_multiplier, sort_order) VALUES
  ('t-x-post',    'X投稿',          'content',  '#F59E0B', 30,  'morning',   '["x"]',               '["shock_fact","story_hook","brain_tip"]', 2.0, 1),
  ('t-x-thread',  'Xスレッド',      'content',  '#D97706', 60,  'morning',   '["x"]',               '["thread"]',                             3.0, 2),
  ('t-note',      'note記事',       'content',  '#3B82F6', 120, 'afternoon', '["note"]',             '["article"]',                            5.0, 3),
  ('t-ig-reel',   'IGリール',       'content',  '#06b6d4', 45,  'afternoon', '["instagram"]',        '["reel_script"]',                        3.0, 4),
  ('t-tiktok',    'TikTok',         'content',  '#06b6d4', 45,  'afternoon', '["tiktok"]',           '["reel_script"]',                        3.0, 5),
  ('t-line',      'LINE配信',       'content',  '#22c55e', 20,  'evening',   '["line"]',             '["line_message"]',                       2.0, 6),
  ('t-layer0',    'Layer 0演習開発','ace_work',  '#8B5CF6', 60,  'morning',   NULL,                   NULL,                                     3.0, 7),
  ('t-lian-ss',   'リアンセッション','ace_work', '#6D28D9', 90,  'afternoon', NULL,                   NULL,                                     4.0, 8),
  ('t-content-dev','コンテンツ開発','ace_work',  '#EC4899', 60,  'afternoon', NULL,                   NULL,                                     3.0, 9),
  ('t-coconala',  'Coconala対応',   'business', '#F97316', 60,  'morning',   NULL,                   NULL,                                     1.5, 10),
  ('t-mtg',       'MTG',            'business', '#6b7280', 60,  'morning',   NULL,                   NULL,                                     1.0, 11),
  ('t-admin',     '事務作業',       'business', '#6b7280', 30,  'morning',   NULL,                   NULL,                                     1.0, 12),
  ('t-training',  'トレーニング',   'life',     '#22c55e', 90,  'morning',   NULL,                   NULL,                                     1.5, 13),
  ('t-rest',      '休息',           'life',     '#1e3a5f', 60,  'evening',   NULL,                   NULL,                                     0.5, 14),
  ('t-custom',    'カスタム',       'life',     '#e8e4df', 30,  NULL,        NULL,                   NULL,                                     1.0, 15);
