export type SegmentType =
  | 'fire_action'
  | 'air_explorer'
  | 'water_empath'
  | 'earth_builder'
  | 'fire_visionary'
  | 'air_analyst'
  | 'water_connector'
  | 'earth_guardian';

export interface Segment {
  name: string;
  desc: string;
  trait: string;
  recommend: string;
  recommendLabel: string;
  color: string;
}

export const SEGMENTS: Record<SegmentType, Segment> = {
  fire_action: {
    name: '行動先行型',
    desc: '考えるより先に身体が動く。比較の火を燃料に変えやすい素質を持つ。最初の一歩が最大の武器。',
    trait: 'ドーパミン主軸 · 外向 · 直感',
    recommend: '/ace/reset',
    recommendLabel: 'Performance Reset 7days',
    color: '#e05c2a',
  },
  air_explorer: {
    name: '思考探索型',
    desc: '構造を理解してから動く。なぜを解明することが動機の根本。知的刺激が最大の燃料。',
    trait: 'ドーパミン主軸 · 内向 · 直感',
    recommend: '/ace/diagnostic',
    recommendLabel: '認知特性レポート',
    color: '#4a9eca',
  },
  water_empath: {
    name: '共感共鳴型',
    desc: '人との繋がりが原動力。感情の動きに敏感で、場のエネルギーを読む力が強い。',
    trait: 'オキシトシン主軸 · 外向 · 感情',
    recommend: '/ace/quest',
    recommendLabel: 'Athlete Quest',
    color: '#3a9e8a',
  },
  earth_builder: {
    name: '構造構築型',
    desc: 'コツコツ積み上げることに喜びを感じる。継続と完成度が行動の原動力。',
    trait: 'セロトニン主軸 · 内向 · 感覚',
    recommend: '/ace/coaching',
    recommendLabel: 'ACE 3ヶ月集中コーチング',
    color: '#7a6e5a',
  },
  fire_visionary: {
    name: 'ビジョン牽引型',
    desc: '大きな絵を描き、そこから逆算で動く。理想の自分像が最大のエンジン。',
    trait: 'ドーパミン主軸 · 外向 · 直感',
    recommend: '/ace/coaching',
    recommendLabel: 'ACE 3ヶ月集中コーチング',
    color: '#d4a943',
  },
  air_analyst: {
    name: '分析精度型',
    desc: 'データと論理で判断する。正確さと一貫性を重視。深く考えることが得意。',
    trait: 'ドーパミン主軸 · 内向 · 感覚',
    recommend: '/ace/diagnostic',
    recommendLabel: '認知特性レポート',
    color: '#6a7ec8',
  },
  water_connector: {
    name: '場創造型',
    desc: 'チームや場の空気を作ることが得意。人が動きやすい環境を自然に整える。',
    trait: 'オキシトシン主軸 · 外向 · 感情',
    recommend: '/ace/quest',
    recommendLabel: 'Athlete Quest',
    color: '#2a9e6a',
  },
  earth_guardian: {
    name: '安定守護型',
    desc: '守るべきものがあるときに最大の力を発揮する。責任感と誠実さが強み。',
    trait: 'セロトニン主軸 · 内向 · 感覚',
    recommend: '/ace/coaching',
    recommendLabel: 'ACE 3ヶ月集中コーチング',
    color: '#8a7a6a',
  },
};

export interface DiagnoseAnswers {
  q1: string; // E/I
  q2: string; // S/N
  q3: string; // T/F
  q4: string; // J/P
  q5: string; // 動機源 (比較/ビジョン/繋がり/積み上げ)
}

export function diagnose(answers: DiagnoseAnswers): SegmentType {
  const ei = answers.q1; // E or I
  const sn = answers.q2; // S or N
  const tf = answers.q3; // T or F
  const jp = answers.q4; // J or P
  const motivation = answers.q5; // compare/vision/connect/build

  // 動機源を優先軸として8タイプに分類
  if (motivation === 'compare' || motivation === 'vision') {
    // ドーパミン系
    if (ei === 'E' && sn === 'N') return 'fire_action';
    if (ei === 'I' && sn === 'N') return 'air_explorer';
    if (ei === 'E' && tf === 'T') return 'fire_visionary';
    return 'air_analyst';
  } else if (motivation === 'connect') {
    // オキシトシン系
    if (ei === 'E') return 'water_connector';
    return 'water_empath';
  } else {
    // セロトニン系 (build)
    if (jp === 'P') return 'earth_builder';
    return 'earth_guardian';
  }
}
