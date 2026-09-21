export type CoconalaAgentStage =
  | 'ASSET_SOURCE'
  | 'PACKAGE'
  | 'QA'
  | 'READY_TO_PUBLISH'
  | 'LIVE'
  | 'SALE_DETECTED'
  | 'DELIVERED'
  | 'LEARN'
  | 'PAUSED';

export type AutomationLane = 'AI_RUN' | 'PLATFORM_AUTO' | 'MASA_GATE';

export type RevenueStep = {
  id: string;
  title: string;
  detail: string;
  lane: AutomationLane;
  recurring: boolean;
};

export const COCONALA_REVENUE_AGENT = {
  missionId: 'T0087',
  missionName: 'AI Venture Studio | Mission 001 | AI-only first revenue',
  purpose: '人間の継続対応を前提にせず、既存知識資産から最初の自動売上をつくる。',
  market: 'Coconala Contents Market',
  strategy: 'PRODUCTIZED_CONTENT',
  automationTarget: 0.95,
  offer: {
    workingTitle: '考えすぎて動けない人のための AI言語化→7日行動設計ワークブック',
    format: 'PDF / text template / AI prompt pack',
    promise: '曖昧な悩みを、AIとの対話で「仮説」と「次の7日間の行動」に整理する。',
    sourceAsset: '既存ココナラサービス4「AI言語化・行動設計セッション」',
    deliverables: [
      '頭の中を整理する7ステップ質問',
      '強み・関心・価値観の仮説整理シート',
      '仕事・活動候補を広げるAIプロンプト',
      '自己紹介・キャッチコピー生成プロンプト',
      '7日間アクションプランシート',
      'AI出力を鵜呑みにしない検証チェックリスト',
    ],
  },
  hardRules: [
    '購入者との外部連絡・外部決済へ誘導しない',
    '診断・適職断定・成果保証をしない',
    '存在しない実績や数値を生成しない',
    '同一コンテンツの重複出品で露出を水増ししない',
    '公開・大幅価格変更・規約例外はHuman Gateに残す',
  ],
} as const;

export const COCONALA_REVENUE_STEPS: RevenueStep[] = [
  { id: 'source', title: '既存資産を選ぶ', detail: 'Driveの既存資産から商品化候補を抽出', lane: 'AI_RUN', recurring: true },
  { id: 'package', title: '商品を組む', detail: '本文・テンプレ・プロンプト・表紙コピーを生成', lane: 'AI_RUN', recurring: true },
  { id: 'qa', title: 'QA', detail: '誇大表現・規約・再現性・内容不足を検査', lane: 'AI_RUN', recurring: true },
  { id: 'publish', title: '公開', detail: 'Preview確認後に公開する', lane: 'MASA_GATE', recurring: false },
  { id: 'sale', title: '販売', detail: '決済・コンテンツ受け渡しはMarketplace側', lane: 'PLATFORM_AUTO', recurring: true },
  { id: 'detect', title: '売上検知', detail: '通知メール/売上記録をSignalとして取り込む', lane: 'AI_RUN', recurring: true },
  { id: 'learn', title: '改善', detail: '閲覧・販売・反応からタイトル/価格/商品内容の改善案を作る', lane: 'AI_RUN', recurring: true },
  { id: 'change', title: '重大変更', detail: '価格・公開状態・規約に関わる変更だけ承認', lane: 'MASA_GATE', recurring: true },
];

export function automationCoverage(steps: RevenueStep[] = COCONALA_REVENUE_STEPS) {
  if (!steps.length) return 0;
  const automated = steps.filter((step) => step.lane !== 'MASA_GATE').length;
  return automated / steps.length;
}

export function humanGateCount(steps: RevenueStep[] = COCONALA_REVENUE_STEPS) {
  return steps.filter((step) => step.lane === 'MASA_GATE').length;
}

export function stageLabel(stage: CoconalaAgentStage) {
  const labels: Record<CoconalaAgentStage, string> = {
    ASSET_SOURCE: '資産選定',
    PACKAGE: '商品化',
    QA: 'QA',
    READY_TO_PUBLISH: '公開待ち',
    LIVE: '販売中',
    SALE_DETECTED: '売上検知',
    DELIVERED: '自動納品',
    LEARN: '改善',
    PAUSED: '停止',
  };
  return labels[stage];
}

export function nextStage(stage: CoconalaAgentStage): CoconalaAgentStage {
  const flow: Record<CoconalaAgentStage, CoconalaAgentStage> = {
    ASSET_SOURCE: 'PACKAGE',
    PACKAGE: 'QA',
    QA: 'READY_TO_PUBLISH',
    READY_TO_PUBLISH: 'LIVE',
    LIVE: 'SALE_DETECTED',
    SALE_DETECTED: 'DELIVERED',
    DELIVERED: 'LEARN',
    LEARN: 'LIVE',
    PAUSED: 'PAUSED',
  };
  return flow[stage];
}

export function requiresHumanGate(from: CoconalaAgentStage, to: CoconalaAgentStage) {
  return from === 'READY_TO_PUBLISH' && to === 'LIVE';
}
