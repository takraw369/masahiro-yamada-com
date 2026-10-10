export const HOME_PRESET_STORAGE_KEY = 'masa.dashboard.home.design-preset.v1';

export const homeDesignPresets = [
  {
    id: 'dawn',
    name: 'Dawn Focus',
    subtitle: '余白で、次の一手を際立たせる。',
    description: '生成りと温かいゴールド。落ち着いた判断・毎日の行動に。',
    source: 'Refero Styles / Navbar Gallery',
    tones: ['#f5f1ea', '#ffffff', '#a56c22'],
  },
  {
    id: 'night',
    name: 'Night Gold',
    subtitle: '静かな集中、強い輪郭。',
    description: '黒と金で重要な一手を際立たせる。競技や意思決定に。',
    source: 'Refero Styles / Supahero',
    tones: ['#10141b', '#1c2530', '#cfac70'],
  },
  {
    id: 'ocean',
    name: 'Ocean Flow',
    subtitle: '考えが流れ、選択が軽くなる。',
    description: 'ブルー・ターコイズで情報を見通しやすく。',
    source: 'Refero Styles / Navbar Gallery',
    tones: ['#eef5f6', '#ffffff', '#167e88'],
  },
  {
    id: 'glass',
    name: 'Glass Layers',
    subtitle: '奥行きのある、軽い操作面。',
    description: '淡い青紫の層と透け感。グラス表現を軽量CSSで再構成。',
    source: 'Sam Asante Liquid Glass / Refero Styles',
    tones: ['#edf0fc', '#ffffff', '#6677c5'],
  },
  {
    id: 'editorial',
    name: 'Editorial Calm',
    subtitle: '雑誌のように、言葉を主役に。',
    description: '紙とインク、タイポグラフィ。ノートや教育コンテンツに。',
    source: 'Supahero / Footer Design',
    tones: ['#f8f5ec', '#fffcf5', '#4e5149'],
  },
  {
    id: 'quest',
    name: 'Quest Energy',
    subtitle: '前進が見える、行動型コックピット。',
    description: '深いネイビーとライム。Questや進捗を力強く可視化。',
    source: '3dicons / Scrolltide / CTA Gallery',
    tones: ['#142a31', '#1d3a42', '#b4df73'],
  },
] as const;

export type HomeDesignPresetId = (typeof homeDesignPresets)[number]['id'];
export function isHomeDesignPreset(value: unknown): value is HomeDesignPresetId {
  return typeof value === 'string' && homeDesignPresets.some(preset => preset.id === value);
}
