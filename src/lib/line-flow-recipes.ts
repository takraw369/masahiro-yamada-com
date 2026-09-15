export type StarterRecipeStep = {
  offsetDays: number;
  offsetMinutes?: number;
  angle: string;
  message: string;
};

export type StarterRecipe = {
  id:
    | 'welcome'
    | 'diagnosis'
    | 'education'
    | 'offer-soft'
    | 'reactivate'
    | 'quest-soft-return'
    | 'quest-complete';
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
    name: '新規登録｜7日',
    purpose: '安心 → 現在地 → 小さな体験 → 理解 → 自己選択。入口で詰め込まず、本人が次を選べる状態をつくる。',
    triggerType: 'friend_add',
    steps: [
      { offsetDays: 0, angle: '安心', message: '登録ありがとう。ここでは、急いで何かを変えるより「今の自分に気づく」ことから始めます。まずは今日の身体や気分を、ひと言で表すなら何ですか？' },
      { offsetDays: 1, angle: '現在地', message: '今いちばん整えたいものを一つ選ぶなら、「身体・思考・感情・行動」のどれに近いですか？正解はなく、今の感覚で大丈夫です。' },
      { offsetDays: 3, angle: '小さな体験', message: '今日は1分だけ。呼吸・姿勢・足裏のうち、いちばん気になる場所を観察してみてください。良くしようとせず、気づくだけで十分です。' },
      { offsetDays: 5, angle: '理解', message: '行動を変える前に、何が噛み合っていないかが見えると選び方が変わります。ここまでで「前より分かった」と感じることはありますか？' },
      { offsetDays: 7, angle: '自己選択', message: 'ここから先は、今の自分に必要な方向を選べます。「もう少し深める」「別テーマを見る」「いったん休む」のどれが近いですか？' },
    ],
  },
  {
    id: 'diagnosis', icon: '🧭', name: '診断導線｜5通',
    purpose: '問い → 診断 → 結果理解 → 小さな実験 → 次の選択。診断をラベルで終わらせず、行動に接続する。', triggerType: 'manual',
    steps: [
      { offsetDays: 0, angle: '問い', message: '今の状態を決めつける前に、まず「どこが噛み合っていないか」を見てみませんか？短いチェックから始められます。' },
      { offsetDays: 0, offsetMinutes: 20, angle: '診断', message: 'チェックは点数を競うものではなく、今の状態の地図をつくるためのものです。気になる項目だけでも見てみてください。' },
      { offsetDays: 1, angle: '結果理解', message: '結果を見る時は「良い・悪い」より、どこに偏りや詰まりがあるかを見ると使いやすくなります。いちばん気になった部分はどこでしたか？' },
      { offsetDays: 3, angle: '小さな実験', message: '結果から一つだけ選び、1〜3分で試せることにしてみましょう。変化が小さくても、前後の違いを拾えれば十分です。' },
      { offsetDays: 5, angle: '次の選択', message: 'ここまでの観察を踏まえて、次は「続ける」「別の項目を見る」「少し置く」から選べます。今いちばん自然なのはどれですか？' },
    ],
  },
  {
    id: 'education', icon: '📚', name: '教育｜7通',
    purpose: '問い → Why → Reframe → 体験 → Story → 統合 → 次の一歩。知識を受け取るだけで終わらせない。', triggerType: 'manual',
    steps: [
      { offsetDays: 0, angle: '問い', message: '「分かっているのに動けない」とき、足りないのは意志ではなく何だと思いますか？' },
      { offsetDays: 1, angle: 'Why', message: '人は情報だけで変わるわけではなく、身体・環境・感情・意味づけが同時に影響します。だから一か所だけ責めない方が次を探しやすくなります。' },
      { offsetDays: 2, angle: 'Reframe', message: '「続かない」を失敗ではなく、今の設計が自分に合っていないという情報として見ると、修正可能な問題に変わります。' },
      { offsetDays: 4, angle: '体験', message: '今日は知識を増やす代わりに、1分だけ身体の反応を観察してみてください。理解より先に体験を一つ増やします。' },
      { offsetDays: 5, angle: 'Story', message: '自分の変化を短い物語にすると、学びが定着しやすくなります。「前は〜、今は〜」の一文で表すならどうなりますか？' },
      { offsetDays: 6, angle: '統合', message: 'ここまでで役に立った考え方を一つだけ残すなら何ですか？全部覚えるより、使える一つを持ち帰る方が強いです。' },
      { offsetDays: 7, angle: '次の一歩', message: '次に進むなら、今日から使える最小の一歩を一つだけ選びましょう。必要なら別のテーマへ移っても大丈夫です。' },
    ],
  },
  {
    id: 'offer-soft', icon: '🚪', name: '商品・サービス｜5通',
    purpose: '課題理解 → 選択肢 → 具体像 → 条件確認 → 自己選択。押し切らず、合う人だけが次へ進める導線。', triggerType: 'manual',
    steps: [
      { offsetDays: 0, angle: '課題理解', message: 'ここまで試してみて、一人では整理しにくい部分や、もう少し伴走があると進みやすそうな部分はありますか？' },
      { offsetDays: 1, angle: '選択肢', message: '必要なら、もう少し深く扱う方法もあります。ただ、今は自分で続ける・相談する・いったん置く、どれを選んでも大丈夫です。' },
      { offsetDays: 3, angle: '具体像', message: '伴走を使う場合は、答えを渡すより「観察 → 選択 → 実行 → 振り返り」を一緒に整える形です。合いそうかどうかだけ見てください。' },
      { offsetDays: 5, angle: '条件確認', message: 'もし検討するなら、時間・費用・取り組み方が今の生活に無理なく入るかを先に確認するのがおすすめです。質問があれば返信してください。' },
      { offsetDays: 7, angle: '自己選択', message: '進む・今回は見送る、どちらでもOKです。今の自分にとって納得できる選択を優先してください。' },
    ],
  },
  {
    id: 'reactivate', icon: '🌙', name: '休眠｜再接続',
    purpose: '許可 → 新しい問い → 軽い入口 → 選択 → クールダウン。反応がない人を追い続けない。', triggerType: 'manual',
    steps: [
      { offsetDays: 0, angle: '許可', message: 'しばらく間が空いています。今すぐ戻る必要はありません。必要になった時に、ここを入口として使ってください。' },
      { offsetDays: 3, angle: '新しい問い', message: '前回の続きではなく、今の自分に一つだけ聞くなら「最近いちばん変わったことは何？」からでも十分です。' },
      { offsetDays: 7, angle: '軽い入口', message: 'もし少し触れたくなったら、1分だけの観察や短いチェックから再開できます。全部やり直す必要はありません。' },
      { offsetDays: 14, angle: '選択', message: 'このまま通知を少なくする、必要な時だけ見る、もう一度進める。今の自分に合う距離感を選んでください。' },
      { offsetDays: 30, angle: 'クールダウン', message: 'こちらからの案内はいったん弱めます。必要になった時に話しかけてもらえれば、そこから再開できます。' },
    ],
  },
  {
    id: 'quest-soft-return', icon: '🌿', name: 'Quest｜やさしい再開', purpose: 'Questが止まりそうな時に、催促ではなく角度を変えながら戻る余白をつくる。', triggerType: 'manual',
    steps: [
      { offsetDays: 1, angle: '許可・最小化', message: '今日は「やる日」にしなくても大丈夫。もし少し触れられそうなら、Questを全部ではなく“1分だけ”見てみよう。終わらなくてもOKです。' },
      { offsetDays: 2, angle: '選択・主体性', message: '昨日できたかどうかはいったん置いておこう。今日は「身体を少し整える」「1問だけ答える」なら、どちらが軽そうですか？選ばない、も選択肢です。' },
      { offsetDays: 4, angle: '再解釈', message: '続かなかった＝失敗ではなく、今の生活に合うリズムを探している途中かもしれません。戻るなら前回の続きではなく、いちばん軽いところからで大丈夫。' },
      { offsetDays: 7, angle: '自律・クールダウン', message: 'ここまでの通知が多く感じたら、いったん距離を置いてOKです。Questは追いかけられるものではなく、必要な時に戻れる場所にしておきましょう。' },
    ],
  },
  {
    id: 'quest-complete', icon: '✨', name: 'Quest完了｜内省へ', purpose: '完了をゴールにせず、体験 → 言語化 → 次の自発行動へつなぐ。', triggerType: 'manual',
    steps: [
      { offsetDays: 0, angle: '承認', message: 'Quest完了。まず「できた・できない」ではなく、やる前と後で何が少し違ったかを一つだけ拾ってみてください。' },
      { offsetDays: 1, angle: '言語化', message: '昨日の体験を誰かに30秒で説明するとしたら、何と言いますか？自分の言葉になった部分が、そのまま次の学びになります。' },
      { offsetDays: 3, angle: '自己選択', message: '次に進むなら、今いちばん気になるテーマからでOKです。「続ける」「別テーマへ」「少し休む」のどれが今の自分に合いそうですか？' },
    ],
  },
];
