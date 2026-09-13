export type StarterRecipeStep = {
  offsetDays: number;
  offsetMinutes?: number;
  angle: string;
  message: string;
};

export type StarterRecipe = {
  id: 'welcome' | 'quest-soft-return' | 'quest-complete';
  icon: string;
  name: string;
  purpose: string;
  triggerType: 'friend_add' | 'manual';
  steps: StarterRecipeStep[];
};

export const QUEST_GUARDRAILS = [
  { when: 'Quest未実行 1日', then: '許可 + 1分だけ。未実行そのものを責めない。' },
  { when: '未実行が続く', then: '同じ催促を繰り返さず、選択肢 → 再解釈へ切り口を変える。' },
  { when: '2回反応なし', then: '毎日追わず、間隔を空ける。通知を弱める選択肢も渡す。' },
  { when: 'Quest完了', then: '外から褒め続けるより「何が変わった？」と自己観察へ返す。' },
] as const;

export const STARTER_RECIPES: StarterRecipe[] = [
  {
    id: 'welcome',
    icon: '👋',
    name: 'はじめまして｜3日',
    purpose: '友だち追加直後に詰め込まず、安心 → 小さな体験 → 次の入口をつくる。',
    triggerType: 'friend_add',
    steps: [
      {
        offsetDays: 0,
        angle: '安心',
        message: '登録ありがとう。ここでは、急いで何かを変えるより「今の自分に気づく」ことから始めます。まずは今日の身体や気分を、ひと言で表すなら何ですか？',
      },
      {
        offsetDays: 1,
        angle: '小さな体験',
        message: '今日は1分だけ。呼吸・姿勢・足裏のうち、いちばん気になる場所を観察してみてください。良くしようとせず、気づくだけで十分です。',
      },
      {
        offsetDays: 3,
        angle: '次の入口',
        message: 'ここまでで何か一つでも「前より分かった」があれば、それが次の入口です。もう少し進めたいテーマがあれば、そこから選びましょう。',
      },
    ],
  },
  {
    id: 'quest-soft-return',
    icon: '🌿',
    name: 'Quest｜やさしい再開',
    purpose: 'Questが止まりそうな時に、催促ではなく角度を変えながら戻る余白をつくる。',
    triggerType: 'manual',
    steps: [
      {
        offsetDays: 1,
        angle: '許可・最小化',
        message: '今日は「やる日」にしなくても大丈夫。もし少し触れられそうなら、Questを全部ではなく“1分だけ”見てみよう。終わらなくてもOKです。',
      },
      {
        offsetDays: 2,
        angle: '選択・主体性',
        message: '昨日できたかどうかはいったん置いておこう。今日は「身体を少し整える」「1問だけ答える」なら、どちらが軽そうですか？選ばない、も選択肢です。',
      },
      {
        offsetDays: 4,
        angle: '再解釈',
        message: '続かなかった＝失敗ではなく、今の生活に合うリズムを探している途中かもしれません。戻るなら前回の続きではなく、いちばん軽いところからで大丈夫。',
      },
      {
        offsetDays: 7,
        angle: '自律・クールダウン',
        message: 'ここまでの通知が多く感じたら、いったん距離を置いてOKです。Questは追いかけられるものではなく、必要な時に戻れる場所にしておきましょう。',
      },
    ],
  },
  {
    id: 'quest-complete',
    icon: '✨',
    name: 'Quest完了｜内省へ',
    purpose: '完了をゴールにせず、体験 → 言語化 → 次の自発行動へつなぐ。',
    triggerType: 'manual',
    steps: [
      {
        offsetDays: 0,
        angle: '承認',
        message: 'Quest完了。まず「できた・できない」ではなく、やる前と後で何が少し違ったかを一つだけ拾ってみてください。',
      },
      {
        offsetDays: 1,
        angle: '言語化',
        message: '昨日の体験を誰かに30秒で説明するとしたら、何と言いますか？自分の言葉になった部分が、そのまま次の学びになります。',
      },
      {
        offsetDays: 3,
        angle: '自己選択',
        message: '次に進むなら、今いちばん気になるテーマからでOKです。「続ける」「別テーマへ」「少し休む」のどれが今の自分に合いそうですか？',
      },
    ],
  },
];
