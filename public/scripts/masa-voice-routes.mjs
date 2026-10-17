// Strict, local routing for the iPhone Voice Commander pilot.
// This classifies the command only; it never performs side effects.
const normalize = (value) => String(value ?? '').normalize('NFKC').trim();
const has = (text, words) => words.some((word) => text.includes(word));

const NAV = [
  { terms: ['カレンダー', '予定表'], href: '/dashboard/schedule', label: 'Calendar' },
  { terms: ['タスク一覧', 'タスク画面'], href: '/dashboard/tasks', label: 'Task Flow' },
  { terms: ['アプリ一覧', 'アプリを探す'], href: '/dashboard/apps', label: 'App Library' },
  { terms: ['知識画面', 'ナレッジ画面'], href: '/dashboard/knowledge', label: 'FLOW MIND' },
  { terms: ['X下書き画面', '投稿画面'], href: '/dashboard/post', label: 'X Post' },
];

export function routeVoiceCommand(input) {
  const text = normalize(input);
  if (!text) return { kind: 'empty' };
  if (text.length > 2000) return { kind: 'too_long' };
  // Never mistake an irreversible request for a normal knowledge question.
  if (has(text, ['投稿して', '公開して', '送信して', '削除して', '決済して', '支払って', '課金して', '本番反映して', 'デプロイして', 'マージして'])) {
    return { kind: 'human_gate', text };
  }
  if (has(text, ['スクロール', 'スワイプ', 'タップして', '音量を', 'ホーム画面', '画面をロック', '画面を戻'])) {
    return { kind: 'device', text };
  }
  if (has(text, ['今日の予定', '今日のタスク', '今日何する', 'きょう何する', '今日やる', '優先順位', '今日の3つ', '今のタスク'])) {
    return { kind: 'today' };
  }
  if (has(text, ['覚えて', '記録して', '資産化して', 'メモして', '保存して'])) {
    let content = text.replace(/^(?:ねえ[、, ]*)?(?:慧|けい|ケイ)[、, ]*/, '')
      .replace(/^(?:これ|この話|このアイデア|今のアイデア)を?[、, ]*/, '')
      .replace(/^(?:覚えて|記録して|資産化して|メモして|保存して)[。.!！]*[、, ]*/, '')
      .trim();
    // A bare command needs a follow-up; do not save "remember this" as content.
    if (/^(?:これを?)?(?:覚えて|記録して|資産化して|メモして|保存して)[。.!！]*$/.test(content) || content === '') content = '';
    return { kind: 'capture', text: content };
  }
  if (has(text, ['開いて', '表示して', '見せて'])) {
    const item = NAV.find((entry) => has(text, entry.terms));
    if (item) return { kind: 'navigate', href: item.href, label: item.label };
  }
  return { kind: 'ask', question: text };
}
