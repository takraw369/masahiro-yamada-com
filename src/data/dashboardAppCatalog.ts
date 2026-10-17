/** Curated launch surfaces in masahiro-yamada-com. Keep URLs grounded in src/pages or public/; do not present these as live health checks. */
export type DashboardAppCategory = 'discover' | 'create' | 'think' | 'operate';
export type DashboardAppAccess = 'public' | 'dashboard';
export type DashboardApp = {
  id: string;
  title: string;
  description: string;
  href: string;
  category: DashboardAppCategory;
  access: DashboardAppAccess;
  symbol: string;
  tags: string[];
  featured: boolean;
};

export const dashboardAppCategories: { id: DashboardAppCategory; label: string; summary: string }[] = [
  { id: 'discover', label: '体験・学び', summary: '撮る、試す、発見する' },
  { id: 'create', label: 'つくる・届ける', summary: 'アイデアを形にして届ける' },
  { id: 'think', label: '考える・深める', summary: '判断・学習・気づきを磨く' },
  { id: 'operate', label: '進める・管理する', summary: '日々の仕事と実装を回す' },
];

export const dashboardAppCatalog: DashboardApp[] = [
  {
    id: 'masa-voice-commander',
    title: 'MASA Voice Commander',
    description: 'iPhoneの音声入力からKnowledge OSとTask Flowへ。実行前に内容を確認。',
    href: '/dashboard/voice-commander',
    category: 'operate',
    access: 'dashboard',
    symbol: '🎙️',
    tags: ['iPhone', '音声', 'AI秘書', 'Siri', 'Task'],
    featured: true,
  },
  {
    "id": "habit-roi",
    "title": "習慣の損益分岐点 | Habit ROI",
    "description": "習慣を変えた場合の支出・時間・初期費用の損益分岐点を無料で試算。",
    "href": "/tools/habit-roi/",
    "category": "discover",
    "access": "public",
    "symbol": "⏳",
    "tags": ["習慣", "健康", "支出", "損益分岐点", "シミュレーター"],
    "featured": true
  },
  {
    "id": "food-lens",
    "title": "Food Lens",
    "description": "食品の裏面を撮影。成分を発見して図鑑を育てる。",
    "href": "/food-lens/",
    "category": "discover",
    "access": "public",
    "symbol": "📸",
    "tags": [
      "食品",
      "撮影",
      "成分",
      "スキャン"
    ],
    "featured": true
  },
  {
    "id": "flow-life",
    "title": "FLOW LIFE",
    "description": "今の状態をチェックして、今日のQuestを始める。",
    "href": "/flow-life/",
    "category": "discover",
    "access": "public",
    "symbol": "⚡",
    "tags": [
      "習慣",
      "Quest",
      "XP",
      "ゲーム"
    ],
    "featured": true
  },
  {
    "id": "flow-mind",
    "title": "FLOW MIND",
    "description": "思いつきや気づきを、残して育てる。",
    "href": "/mind",
    "category": "discover",
    "access": "dashboard",
    "symbol": "🧠",
    "tags": [
      "ノート",
      "知識",
      "メモ"
    ],
    "featured": false
  },
  {
    "id": "flow-check",
    "title": "FLOW Check",
    "description": "いまの状態を軽くチェックする。",
    "href": "/flow-check.html",
    "category": "discover",
    "access": "public",
    "symbol": "🌊",
    "tags": [
      "フロー",
      "診断",
      "セルフチェック"
    ],
    "featured": false
  },
  {
    "id": "mental-check",
    "title": "Mental Check",
    "description": "心の状態を観察するチェック体験。",
    "href": "/mental-check",
    "category": "discover",
    "access": "public",
    "symbol": "🪷",
    "tags": [
      "メンタル",
      "チェック"
    ],
    "featured": false
  },
  {
    "id": "learn",
    "title": "ACE Learn",
    "description": "公開中の学びのコンテンツへ。",
    "href": "/learn",
    "category": "discover",
    "access": "public",
    "symbol": "📚",
    "tags": [
      "教育",
      "学習"
    ],
    "featured": false
  },
  {
    "id": "flow-board",
    "title": "FLOW Board",
    "description": "アイデアと事業のつながりをカードで整理。",
    "href": "/dashboard/board",
    "category": "create",
    "access": "dashboard",
    "symbol": "🗺️",
    "tags": [
      "ボード",
      "マインドマップ",
      "カード"
    ],
    "featured": true
  },
  {
    "id": "note-harness",
    "title": "Note Harness",
    "description": "note向けコンテンツの制作を整える。",
    "href": "/dashboard/note-harness",
    "category": "create",
    "access": "dashboard",
    "symbol": "✍️",
    "tags": [
      "note",
      "記事",
      "制作"
    ],
    "featured": true
  },
  {
    "id": "knowledge-studio",
    "title": "Knowledge Studio",
    "description": "知識から教材や商品を組み立てる。",
    "href": "/dashboard/content-studio",
    "category": "create",
    "access": "dashboard",
    "symbol": "🧩",
    "tags": [
      "教材",
      "商品",
      "コンテンツ"
    ],
    "featured": false
  },
  {
    "id": "publishing-flow",
    "title": "Publishing Flow",
    "description": "素材から発信までの流れをつなぐ。",
    "href": "/dashboard/content-flow",
    "category": "create",
    "access": "dashboard",
    "symbol": "🚀",
    "tags": [
      "発信",
      "制作",
      "出版"
    ],
    "featured": false
  },
  {
    "id": "x-post",
    "title": "X Post",
    "description": "Xへの投稿を制作・確認する。",
    "href": "/dashboard/post",
    "category": "create",
    "access": "dashboard",
    "symbol": "📝",
    "tags": [
      "SNS",
      "X",
      "投稿"
    ],
    "featured": false
  },
  {
    "id": "visual-prompt",
    "title": "Visual Prompt",
    "description": "視覚表現のプロンプトを組み立てる。",
    "href": "/dashboard/visual-prompt",
    "category": "create",
    "access": "dashboard",
    "symbol": "🎨",
    "tags": [
      "画像",
      "プロンプト",
      "デザイン"
    ],
    "featured": false
  },
  {
    "id": "design-studio",
    "title": "Design Studio",
    "description": "画面デザインとテンプレートを選ぶ。",
    "href": "/dashboard/design-templates",
    "category": "create",
    "access": "dashboard",
    "symbol": "🖼️",
    "tags": [
      "UI",
      "テンプレート",
      "デザイン"
    ],
    "featured": false
  },
  {
    "id": "design-lab",
    "title": "Design Lab",
    "description": "デザインを試作・検討する。",
    "href": "/dashboard/design-lab",
    "category": "create",
    "access": "dashboard",
    "symbol": "🛠️",
    "tags": [
      "試作",
      "UI",
      "UX"
    ],
    "featured": false
  },
  {
    "id": "quest",
    "title": "Quest Board",
    "description": "実践するQuestと進捗を整理。",
    "href": "/dashboard/quest",
    "category": "think",
    "access": "dashboard",
    "symbol": "🎯",
    "tags": [
      "行動",
      "アスリート",
      "学習"
    ],
    "featured": false
  },
  {
    "id": "decision-lens",
    "title": "Decision Lens",
    "description": "選択肢とAI予測から判断を学ぶ。",
    "href": "/dashboard/decision-lens",
    "category": "think",
    "access": "dashboard",
    "symbol": "🔭",
    "tags": [
      "意思決定",
      "AI",
      "予測"
    ],
    "featured": false
  },
  {
    "id": "choice-lab",
    "title": "Choice Lab",
    "description": "迷いを整理して選択肢を比べる。",
    "href": "/dashboard/choice-lab",
    "category": "think",
    "access": "dashboard",
    "symbol": "⚖️",
    "tags": [
      "意思決定",
      "選択"
    ],
    "featured": false
  },
  {
    "id": "evidence",
    "title": "Evidence Lab",
    "description": "事実・根拠・反証を見比べる。",
    "href": "/dashboard/evidence",
    "category": "think",
    "access": "dashboard",
    "symbol": "🔎",
    "tags": [
      "調査",
      "科学",
      "証拠"
    ],
    "featured": false
  },
  {
    "id": "knowledge",
    "title": "Knowledge",
    "description": "知識を探し、つないで資産にする。",
    "href": "/dashboard/knowledge",
    "category": "think",
    "access": "dashboard",
    "symbol": "💡",
    "tags": [
      "知識",
      "検索",
      "資産化"
    ],
    "featured": false
  },
  {
    "id": "meet-targets",
    "title": "Meet Target",
    "description": "まだ会っていないけど会いたい人を登録し、次の一手まで管理。",
    "href": "/dashboard/meet-targets",
    "category": "think",
    "access": "dashboard",
    "symbol": "🎯",
    "tags": ["人脈", "会いたい", "目標", "紹介", "Meet Target"],
    "featured": true
  },
  {
    "id": "ace-people-graph",
    "title": "ACE People Graph",
    "description": "人脈のつながりを自由配置・階層・グループで探索（デモ）。",
    "href": "/dashboard/people",
    "category": "think",
    "access": "dashboard",
    "symbol": "🕸️",
    "tags": ["ACE", "人脈", "関係", "グラフ", "デモ"],
    "featured": true
  },
  {
    "id": "model-canvas",
    "title": "MASA Model Canvas",
    "description": "概念・ERモデル・画面の関係と変更影響を一枚で確認。",
    "href": "/dashboard/model-canvas",
    "category": "think",
    "access": "dashboard",
    "symbol": "🧭",
    "tags": ["設計", "関係", "ER", "画面", "MASA OS"],
    "featured": false
  },
  {
    "id": "graph",
    "title": "Living Graph",
    "description": "知識とプロジェクトの関係を眺める。",
    "href": "/dashboard/graph",
    "category": "think",
    "access": "dashboard",
    "symbol": "🕸️",
    "tags": [
      "グラフ",
      "関係",
      "マップ"
    ],
    "featured": false
  },
  {
    "id": "question-lab",
    "title": "Question Lab",
    "description": "考えるための問いを磨く。",
    "href": "/dashboard/question-lab",
    "category": "think",
    "access": "dashboard",
    "symbol": "❓",
    "tags": [
      "問い",
      "思考"
    ],
    "featured": false
  },
  {
    "id": "task-pipeline",
    "title": "Task Pipeline",
    "description": "フェーズと期限、判断待ちを一画面で俯瞰する。",
    "href": "/dashboard/pipeline",
    "category": "operate",
    "access": "dashboard",
    "symbol": "🗂️",
    "tags": ["タスク", "進捗", "判断", "カンバン"],
    "featured": false
  },
  {
    "id": "task-flow",
    "title": "Task Flow",
    "description": "プロジェクトと次の行動を管理。",
    "href": "/dashboard/tasks",
    "category": "operate",
    "access": "dashboard",
    "symbol": "✅",
    "tags": [
      "タスク",
      "プロジェクト"
    ],
    "featured": false
  },
  {
    "id": "sprint",
    "title": "72H Flow Build",
    "description": "短期集中の実行を組み立てる。",
    "href": "/dashboard/sprint",
    "category": "operate",
    "access": "dashboard",
    "symbol": "⏱️",
    "tags": [
      "スプリント",
      "実装",
      "実行"
    ],
    "featured": false
  },
  {
    "id": "calendar",
    "title": "Calendar",
    "description": "予定と行動の時間を整える。",
    "href": "/dashboard/schedule",
    "category": "operate",
    "access": "dashboard",
    "symbol": "📅",
    "tags": [
      "スケジュール",
      "予定"
    ],
    "featured": false
  },
  {
    "id": "line",
    "title": "LINE Flow",
    "description": "LINE導線とフォローアップを管理。",
    "href": "/dashboard/line",
    "category": "operate",
    "access": "dashboard",
    "symbol": "💬",
    "tags": [
      "LINE",
      "顧客",
      "CRM"
    ],
    "featured": false
  },
  {
    "id": "intelligence",
    "title": "Intelligence",
    "description": "外の情報から必要なものを見つける。",
    "href": "/dashboard/intelligence",
    "category": "operate",
    "access": "dashboard",
    "symbol": "🌐",
    "tags": [
      "情報",
      "収集",
      "リサーチ"
    ],
    "featured": false
  },
  {
    "id": "github-issues",
    "title": "GitHub Workboard",
    "description": "Issue・PR・CIの進行とGateを確認。",
    "href": "/dashboard/github-issues",
    "category": "operate",
    "access": "dashboard",
    "symbol": "🔧",
    "tags": [
      "GitHub",
      "PR",
      "開発"
    ],
    "featured": false
  },
  {
    "id": "ai-commands",
    "title": "AI Commands",
    "description": "目的に合ったAI指示をすぐ使う。",
    "href": "/dashboard/ai-commands",
    "category": "operate",
    "access": "dashboard",
    "symbol": "✨",
    "tags": [
      "AI",
      "指示",
      "プロンプト"
    ],
    "featured": false
  },
  {
    "id": "chat-sweep",
    "title": "Chat Sweep",
    "description": "チャットを整理して資産化へ。",
    "href": "/dashboard/chat-sweep",
    "category": "operate",
    "access": "dashboard",
    "symbol": "🗃️",
    "tags": [
      "整理",
      "アーカイブ",
      "資産化"
    ],
    "featured": false
  }
];
export const featuredDashboardApps = dashboardAppCatalog.filter(app => app.featured);
