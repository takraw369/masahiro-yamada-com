export type RiskLevel = 'normal' | 'watch' | 'elevated' | 'severe' | 'unknown';

export type RiskSignal = {
  key: string;
  label: string;
  value: number | null;
  formatted: string;
  monthChange: number | null;
  monthChangeUnit: '%' | 'bp' | 'pp' | null;
  observedAt: string | null;
  source: string;
  sourceUrl: string;
  level: RiskLevel;
  note: string;
};

const severity: Record<RiskLevel, number> = {
  unknown: -1, normal: 0, watch: 1, elevated: 2, severe: 3,
};

function threshold(value: number, yellow: number, orange: number, red: number): RiskLevel {
  return value >= red ? 'severe' : value >= orange ? 'elevated' : value >= yellow ? 'watch' : 'normal';
}

function maximum(a: RiskLevel, b: RiskLevel): RiskLevel {
  return severity[a] >= severity[b] ? a : b;
}

/** Transparent heuristics, not a predictive crash model or trading signal. */
export function classifyFinancialRisk(key: string, value: number, monthChange: number | null, drawdownPct: number | null = null): RiskLevel {
  switch (key) {
    case 'ust10':
      // For yields, monthChange is percentage points; only abrupt increases raise this indicator.
      return threshold((monthChange ?? 0) * 100, 40, 75, 125);
    case 'jgb10':
      return threshold((monthChange ?? 0) * 100, 25, 50, 85);
    case 'oil':
      return maximum(threshold(value, 100, 120, 150), threshold(monthChange ?? 0, 15, 25, 40));
    case 'usdjpy':
      return threshold(Math.abs(monthChange ?? 0), 5, 8, 12);
    case 'gold':
      return threshold(Math.max(0, monthChange ?? 0), 8, 14, 22);
    case 'credit':
      // ICE BofA US HY OAS is expressed in percent, not basis points.
      return maximum(threshold(value, 4.5, 6, 8), threshold(monthChange ?? 0, 1, 2, 3));
    case 'vix':
      return threshold(value, 20, 30, 45);
    case 'nasdaq':
      return threshold(Math.abs(Math.min(0, drawdownPct ?? 0)), 8, 13, 20);
    default:
      return 'unknown';
  }
}

export function summarizeFinancialRisk(signals: RiskSignal[]) {
  const measured = signals.filter(s => s.level !== 'unknown');
  const coverage = measured.length;
  const severe = measured.filter(s => s.level === 'severe').length;
  const elevated = measured.filter(s => severity[s.level] >= 2).length;
  const warning = measured.filter(s => severity[s.level] >= 1).length;
  const stress = signals.some(s => (s.key === 'credit' || s.key === 'vix') && severity[s.level] >= 2);
  let level: RiskLevel = 'normal';
  if (coverage < 5) level = 'unknown';
  else if (severe >= 3 && stress) level = 'severe';
  else if (severe >= 1 || elevated >= 3) level = 'elevated';
  else if (elevated >= 1 || warning >= 3) level = 'watch';
  return {
    level, coverage, expected: signals.length,
    counts: { severe, elevated, warning },
    description: coverage < 5
      ? '有効データ不足。危険度を判定できません。'
      : level === 'severe'
        ? '複数の強いストレス指標が同時発生。信用・変動率を優先確認。'
        : level === 'elevated'
          ? '市場ストレスが上昇。信用収縮や流動性の追加証拠を確認。'
          : level === 'watch'
            ? '一部指標が警戒帯。継続観測して変化の連鎖を確認。'
            : '観測済み指標は設定した警戒閾値を下回っています。',
  };
}
