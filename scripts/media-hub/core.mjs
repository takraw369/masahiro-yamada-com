export function categorySuggestion(s) {
  const str = s.normalize('NFKC').toLowerCase();
  if (/(screenshot|screen.?record|スクリーンショット|スクショ|画面収録|講義資料|研究資料|ホワイトボード|lecture|research|seminar)/i.test(str)) return ['KNOWLEDGE', 'ファイル名・フォルダ名からの推定'];
  if (/(b.roll|graphic|illustration|creative|素材|デザイン|ロゴ|図解|canva|thumbnail|サムネ|stock|motion|visual)/i.test(str)) return ['CREATIVE', 'ファイル名・フォルダ名からの推定'];
  if (/(takraw|セパタクロー|athlete|試合|大会|競技|メダル|表彰|代表|競技歴|competition|medal)/i.test(str)) return ['EVIDENCE', 'ファイル名・フォルダ名からの推定'];
  if (/(family|家族|旅行|誕生日|ペット|mahru|思い出|vacation|holiday)/i.test(str)) return ['LIFE', 'ファイル名・フォルダ名からの推定'];
  return ['UNSORTED', '内容未解析'];
}
export function sourceUrlFromSidecar(meta) {
  // An export-supplied link is NOT a verified permanent deep link.
  const candidate = meta?.url;
  if (typeof candidate !== 'string' || candidate.length > 2048) return null;
  try {
    const u = new URL(candidate);
    if (u.protocol === 'https:' && u.hostname === 'photos.google.com' && !u.username && !u.password) return u.href;
  } catch {}
  return null;
}
