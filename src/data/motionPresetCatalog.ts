/**
 * MASA-origin motion grammar. Independent CSS/WAAPI implementation: no vendor
 * screenshots, demo code, or data mirrored from Motion Reference.
 */
export type MotionUse = 'entrance' | 'feedback' | 'navigation' | 'learning';
export interface MotionPreset {
  id: string;
  label: string;
  category: MotionUse;
  purpose: string;
  behavior: string;
  duration: number;
  easing: string;
  keyframes: string;
  guidance: string;
}
export const motionCategories: { id: MotionUse | 'all'; label: string }[] = [
  { id: 'all', label: 'すべて' },
  { id: 'entrance', label: '登場' },
  { id: 'feedback', label: '反応・状態' },
  { id: 'navigation', label: '画面遷移' },
  { id: 'learning', label: '学習・進捗' },
];
export const motionPresets: MotionPreset[] = [
  { id: 'quiet-fade', label: '静かな登場', category: 'entrance', purpose: '小見出し・カード', behavior: 'opacity 0→1', duration: 260, easing: 'ease-out', keyframes: 'quiet-fade', guidance: '情報を増やさず登場を知らせる' },
  { id: 'rise', label: 'やわらかく上がる', category: 'entrance', purpose: '説明・結果カード', behavior: 'translateY 12px→0 / opacity', duration: 360, easing: 'cubic-bezier(.2,.7,.2,1)', keyframes: 'rise', guidance: '読み始めの位置を見失わせない' },
  { id: 'slide-side', label: '横から届く', category: 'entrance', purpose: '補助情報・通知', behavior: 'translateX 18px→0 / opacity', duration: 300, easing: 'ease-out', keyframes: 'slide-side', guidance: '方向に意味がある場所だけ使う' },
  { id: 'micro-scale', label: '小さく現れる', category: 'entrance', purpose: '選択結果・補足', behavior: 'scale .96→1 / opacity', duration: 260, easing: 'ease-out', keyframes: 'micro-scale', guidance: '過度な拡大・跳ねを避ける' },
  { id: 'soft-pulse', label: '状態の脈動', category: 'feedback', purpose: '処理中・接続中', behavior: 'opacity .45→1→.45', duration: 1200, easing: 'ease-in-out', keyframes: 'soft-pulse', guidance: '無期限の待ち時間の代替にしない' },
  { id: 'press', label: '押した手応え', category: 'feedback', purpose: 'ボタン反応', behavior: 'translateY 2px→0', duration: 180, easing: 'ease-out', keyframes: 'press', guidance: 'hoverではなく操作時だけ; 押下状態も明示' },
  { id: 'highlight', label: '選択の強調', category: 'feedback', purpose: '選択・重点表示', behavior: 'border-color / outline-color', duration: 320, easing: 'ease-out', keyframes: 'highlight', guidance: '色だけに依存せず文字でも選択を表示' },
  { id: 'swap', label: '内容の切替', category: 'navigation', purpose: 'タブ・表示切替', behavior: 'opacity / translateY 6px', duration: 240, easing: 'ease-out', keyframes: 'swap', guidance: 'タブにキーボード操作を付ける' },
  { id: 'drawer', label: '補助面を開く', category: 'navigation', purpose: '詳細パネル・ドロワー', behavior: 'translateX 24px→0', duration: 280, easing: 'ease-out', keyframes: 'drawer', guidance: '実装時はfocus trapと閉じる操作を別途用意' },
  { id: 'step', label: '次のステップ', category: 'learning', purpose: 'チュートリアル', behavior: 'translateY 9px→0 / opacity', duration: 320, easing: 'ease-out', keyframes: 'step', guidance: 'ステップ番号と内容更新を組み合わせる' },
  { id: 'progress', label: '進捗が伸びる', category: 'learning', purpose: '習熟度・達成率', behavior: 'scaleX 0→1', duration: 650, easing: 'cubic-bezier(.2,.7,.2,1)', keyframes: 'progress', guidance: '最終数値は常にテキストで併記' },
  { id: 'success', label: '完了を伝える', category: 'learning', purpose: '保存完了・正答', behavior: 'opacity / translateY 8px', duration: 340, easing: 'ease-out', keyframes: 'success', guidance: '正誤は文言でも示し、誤答で過剰な罰演出をしない' },
];
export function makeMotionRequest(preset: MotionPreset, target: string, note: string): string {
  const destination = target.trim() || '適用する画面を既存コードから特定する';
  const requestNote = note.trim() || '目的に合う最小箇所へ適用する';
  return [
    'MASA Design Intelligence / Motion Picker からの実装依頼',
    '',
    '適用先: ' + destination,
    'モーション: ' + preset.label + ' (' + preset.id + ')',
    '利用目的: ' + preset.purpose,
    '挙動の仕様: ' + preset.behavior,
    '目安: ' + preset.duration + 'ms / ' + preset.easing,
    'デザイン意図: ' + preset.guidance,
    '追加希望: ' + requestNote,
    '',
    '既存画面・既存Design Studio/Design Grammarと現在の実装をfresh-readし、重複機能を作らず最小差分で追加してください。',
    '元サイトのソース・アニメーション・画像をコピーしない。独自実装で実現し、著作権/ライセンスを遵守。',
    'アクセシビリティ: prefers-reduced-motionに対応。意味・操作を動きだけに依存させない。',
    'iPhone幅320/375/390/430px、44pxタッチターゲット、性能/CLS、キーボード操作を確認。',
    '既存認証・データ・課金/公開フローを変更しない。npm test / typecheck / build / security:check を実行。',
    'PreviewのURL/画像と差分、テスト結果、未確認事項を報告。公開・本番反映は既存Human Gateに従い、無断で実施しない。',
    '参照資料: https://motion-reference.takayustudio.jp/ （学習用、複製用ではない）',
  ].join('\n');
}
