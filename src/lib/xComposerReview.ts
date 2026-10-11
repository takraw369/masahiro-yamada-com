export const X_COMPOSER_MAX_CHARS = 280;
export type XComposeValue = { text: string; accountId: string; mode: 'now' | 'schedule'; scheduledAt: string };
export type XComposeAccount = { id: string; username: string; isActive: boolean };
export type XComposeReview = XComposeValue & { username: string };

export function prepareXComposeReview(value: XComposeValue, accounts: XComposeAccount[], now = Date.now()): XComposeReview {
  if (!value.text.trim()) throw new Error('投稿本文を入力してください。');
  if (value.text.length > X_COMPOSER_MAX_CHARS) throw new Error('本文を280文字以内に整えてください。');
  const account = accounts.find(item => item.id === value.accountId && item.isActive);
  if (!account) throw new Error('送信できる接続先を選んでください。');
  if (value.mode === 'schedule' && (!value.scheduledAt || !Number.isFinite(Date.parse(value.scheduledAt)) || Date.parse(value.scheduledAt) <= now)) throw new Error('予約する未来の日時を選んでください。');
  return { ...value, scheduledAt: value.mode === 'schedule' ? value.scheduledAt : '', username: account.username };
}
export function isCurrentXComposeReview(review: XComposeReview, value: XComposeValue, accounts: XComposeAccount[], now = Date.now()) {
  try {
    const current = prepareXComposeReview(value, accounts, now);
    return (Object.keys(current) as Array<keyof XComposeReview>).every(key => current[key] === review[key]);
  } catch { return false; }
}
