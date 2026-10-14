/** Drive-backed app candidates. Documents are evidence of intent, NOT working apps or live URLs.
 * Keep completed launch routes in dashboardAppCatalog.ts; do not duplicate those as planned.
 * Every href and sourceUrl is an observed Google Drive URL.
 */
export type DashboardAppIdeaStatus = 'prototype' | 'planned';
export type DashboardAppIdea = {
  id: string;
  title: string;
  description: string;
  status: DashboardAppIdeaStatus;
  href: string;
  sourceUrl: string;
  symbol: string;
  tags: string[];
  nextAction: string;
};

export const dashboardAppIdeas: DashboardAppIdea[] = [
  {
    "id": "nutri-flow",
    "title": "NUTRI FLOW",
    "description": "食材とグラム数を変えて、栄養素と1日の摂取基準を比較する。",
    "status": "prototype",
    "href": "https://drive.google.com/file/d/1st4NKewX9ujXqpW57AxpnOQew23V9CRs/view?usp=drivesdk",
    "sourceUrl": "https://drive.google.com/file/d/1HuVz8cl7g5aH6oGHqBhorWIKaq0s74It/view?usp=drivesdk",
    "symbol": "🥦",
    "tags": [
      "栄養",
      "食材",
      "健康",
      "比較",
      "グラフ"
    ],
    "nextAction": "実機動作・食品成分値と摂取基準を検証"
  },
  {
    "id": "thai-life-quest",
    "title": "THAI LIFE QUEST",
    "description": "タイの暮らし・文化・会話を分岐ストーリーで学ぶ体験ゲーム。",
    "status": "prototype",
    "href": "https://drive.google.com/file/d/1-kGzwm-_GXOr89PzvvSAkBbpXUBpACz-/view?usp=drivesdk",
    "sourceUrl": "https://docs.google.com/document/d/1-O-tGLLNytiiOvcQ6Ee5Xc65Nqz08QPVnERFLA19Ei8/edit?usp=drivesdk",
    "symbol": "🇹🇭",
    "tags": [
      "タイ",
      "語学",
      "文化",
      "シミュレーション",
      "Quest"
    ],
    "nextAction": "4シーンの体験版を検証し、20シーン構想を整理"
  },
  {
    "id": "farm-flow",
    "title": "FARM FLOW",
    "description": "必要な栄養から食材・収穫量・栽培面積を逆算する。",
    "status": "planned",
    "href": "https://drive.google.com/file/d/1HuVz8cl7g5aH6oGHqBhorWIKaq0s74It/view?usp=drivesdk",
    "sourceUrl": "https://drive.google.com/file/d/1HuVz8cl7g5aH6oGHqBhorWIKaq0s74It/view?usp=drivesdk",
    "symbol": "🌱",
    "tags": [
      "栽培",
      "農業",
      "栄養",
      "自給",
      "畑"
    ],
    "nextAction": "NUTRI FLOWのデータ契約確定後に栽培量モデルを設計"
  },
  {
    "id": "human-graph",
    "title": "Human Graph",
    "description": "人・紹介・学び・協働の関係を階層でたどり、つながりを可視化する。",
    "status": "planned",
    "href": "https://docs.google.com/document/d/1QjII1jKwce6oBp3-Za8IQVq37LTuxbBvVyubRKk885I/edit?usp=drivesdk",
    "sourceUrl": "https://docs.google.com/document/d/1QjII1jKwce6oBp3-Za8IQVq37LTuxbBvVyubRKk885I/edit?usp=drivesdk",
    "symbol": "🕸️",
    "tags": [
      "人脈",
      "人物",
      "SNS",
      "つながり",
      "関係図",
      "グラフ"
    ],
    "nextAction": "Relationship OSとの役割を切り分け、同意ベースの多階層表示を試作"
  },
  {
    "id": "flower-map",
    "title": "ACE FLOWER MAP",
    "description": "Quest進行・Skill Key・Gate Keyの解放をひとつの成長マップにする。",
    "status": "planned",
    "href": "https://docs.google.com/document/d/14bIPGqggzoAsGnZMjzjshotEZm1U74gx3I-3yahZcBY/edit?usp=drivesdk",
    "sourceUrl": "https://docs.google.com/document/d/14bIPGqggzoAsGnZMjzjshotEZm1U74gx3I-3yahZcBY/edit?usp=drivesdk",
    "symbol": "🌸",
    "tags": [
      "ACE",
      "Quest",
      "Flower",
      "成長",
      "解放"
    ],
    "nextAction": "Day1→Day2解放の進行保存を最小MVPで検証"
  },
  {
    "id": "ace-ai-coach",
    "title": "ACE AI Coach",
    "description": "本番パフォーマンスの課題を整理し、今日の一手と試合レビューを支援する。",
    "status": "planned",
    "href": "https://docs.google.com/document/d/1UDCpsOoKNVFU_g5vNyxEfPNmPJxXjB9rcOL5Oz-W0Mc/edit?usp=drivesdk",
    "sourceUrl": "https://docs.google.com/document/d/1UDCpsOoKNVFU_g5vNyxEfPNmPJxXjB9rcOL5Oz-W0Mc/edit?usp=drivesdk",
    "symbol": "🎽",
    "tags": [
      "AI",
      "コーチ",
      "アスリート",
      "本番",
      "試合"
    ],
    "nextAction": "競技者向けConversation Protocolを1ケースで検証"
  },
  {
    "id": "athlete-career",
    "title": "ATHLETE CAREER OS",
    "description": "競技経験を能力・仕事・発信・商品へ翻訳するキャリア支援。",
    "status": "planned",
    "href": "https://docs.google.com/document/d/1uV7voUOYKjjFi3B_KwJMZkw7yPpH5ywUHMZ6HXZkd0A/edit?usp=drivesdk",
    "sourceUrl": "https://docs.google.com/document/d/1uV7voUOYKjjFi3B_KwJMZkw7yPpH5ywUHMZ6HXZkd0A/edit?usp=drivesdk",
    "symbol": "🏅",
    "tags": [
      "Athlete",
      "キャリア",
      "経験",
      "仕事",
      "教育"
    ],
    "nextAction": "MASAの競技経験をCase 0として構造化"
  },
  {
    "id": "flow-compass-mini",
    "title": "FLOW COMPASS Mini",
    "description": "3分の問いで現在の詰まりを見える化し、今日の1mmを選ぶ。",
    "status": "planned",
    "href": "https://docs.google.com/document/d/18IZKAXUj1bqGoqZv-SjvJBczrgYO3t1uyyl3-MFjcsI/edit?usp=drivesdk",
    "sourceUrl": "https://docs.google.com/document/d/18IZKAXUj1bqGoqZv-SjvJBczrgYO3t1uyyl3-MFjcsI/edit?usp=drivesdk",
    "symbol": "🧭",
    "tags": [
      "診断",
      "FLOW",
      "3分",
      "状態",
      "Mini App"
    ],
    "nextAction": "既存Flow Checkと重複しない5〜10問の体験を定義"
  },
  {
    "id": "ace-flow-gift",
    "title": "ACE FLOW GIFT",
    "description": "モノ・知識・機会を受け取り、体験し、次の人へつなぐ循環体験。",
    "status": "planned",
    "href": "https://docs.google.com/document/d/1PCAdDrYVBBmmqSB9zeWBD-lzrb3q0yFBxoJYmVGytRg/edit?usp=drivesdk",
    "sourceUrl": "https://docs.google.com/document/d/1PCAdDrYVBBmmqSB9zeWBD-lzrb3q0yFBxoJYmVGytRg/edit?usp=drivesdk",
    "symbol": "🎁",
    "tags": [
      "GIFT",
      "ACE",
      "循環",
      "コミュニティ",
      "食育"
    ],
    "nextAction": "最小3カテゴリで受け取り→体験の実証を設計"
  },
  {
    "id": "ace-case-intelligence",
    "title": "ACE Case Intelligence",
    "description": "アスリートの経験・介入・結果を再利用できる事例検索・比較基盤。",
    "status": "planned",
    "href": "https://docs.google.com/document/d/1Deb_zKILxJh2ZohOw_Xbbno6i1SezVSegl5lWauIUq4/edit?usp=drivesdk",
    "sourceUrl": "https://docs.google.com/document/d/1Deb_zKILxJh2ZohOw_Xbbno6i1SezVSegl5lWauIUq4/edit?usp=drivesdk",
    "symbol": "📖",
    "tags": [
      "Case",
      "競技",
      "レビュー",
      "学習",
      "ナレッジ"
    ],
    "nextAction": "実在のCaseを匿名化し共通Schemaを試す"
  },
  {
    "id": "market-radar",
    "title": "Market Radar",
    "description": "公開情報から支援できる相手・市場の課題を発見するリサーチ支援。",
    "status": "planned",
    "href": "https://docs.google.com/document/d/1C0yCIKINtCvR63oTzr8NwY4u5jIv3xNaEIyYLj7uDuA/edit?usp=drivesdk",
    "sourceUrl": "https://docs.google.com/document/d/1C0yCIKINtCvR63oTzr8NwY4u5jIv3xNaEIyYLj7uDuA/edit?usp=drivesdk",
    "symbol": "📡",
    "tags": [
      "市場",
      "AI",
      "顧客",
      "リサーチ",
      "見込み客"
    ],
    "nextAction": "手動検証から始め、自動DMや非公開情報の収集はしない"
  },
  {
    "id": "masa-capital-os",
    "title": "MASA CAPITAL OS",
    "description": "身体・知識・メディア・事業・金融の5資本をまとめて可視化する。",
    "status": "planned",
    "href": "https://docs.google.com/document/d/1udZdPIx9AdQkZCFlj5KMUHP27pLhGpsm-rRykSflJpU/edit?usp=drivesdk",
    "sourceUrl": "https://docs.google.com/document/d/1udZdPIx9AdQkZCFlj5KMUHP27pLhGpsm-rRykSflJpU/edit?usp=drivesdk",
    "symbol": "💠",
    "tags": [
      "資産",
      "事業",
      "金融",
      "健康",
      "キャッシュ"
    ],
    "nextAction": "既存のFinancial Risk等と切り分けて5資本レビューを設計"
  },
  {
    "id": "ai-creative-engine",
    "title": "AI Creative Engine",
    "description": "知識資産を台本・画像・短編動画へ変換する制作エンジン。",
    "status": "planned",
    "href": "https://docs.google.com/document/d/1nJUdBKTFLb074vfnh7S0DDfH_3LiPDHcsLxmYKnYScA/edit?usp=drivesdk",
    "sourceUrl": "https://docs.google.com/document/d/1nJUdBKTFLb074vfnh7S0DDfH_3LiPDHcsLxmYKnYScA/edit?usp=drivesdk",
    "symbol": "🎬",
    "tags": [
      "動画",
      "AI",
      "コンテンツ",
      "制作",
      "自動化"
    ],
    "nextAction": "既存制作導線との接続とMP4生成の完走を検証"
  }
];
