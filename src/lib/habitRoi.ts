/**
 * Habit ROI: cash-and-time scenario estimates only.
 * This module does not estimate medical incidence, treatment cost or clinical outcomes.
 */
export type HabitRoiInput = {
  beforeYen: number;
  afterYen: number;
  occurrencesPerWeek: number;
  initialYen: number;
  minutesBefore: number;
  minutesAfter: number;
};
export type HabitRoiResult = {
  occurrencesPerYear: number;
  annualGrossSavings: number;
  annualHoursReclaimed: number;
  annualNetSavings: number;
  oneYearNet: number;
  fiveYearNet: number;
  tenYearNet: number;
  breakEvenMonths: number | null;
};

function finiteWithin(value: number, low: number, high: number) {
  if (!Number.isFinite(value)) return low;
  return Math.max(low, Math.min(high, value));
}

export function calculateHabitRoi(input: HabitRoiInput): HabitRoiResult {
  const before = finiteWithin(input.beforeYen, 0, 1_000_000);
  const after = finiteWithin(input.afterYen, 0, 1_000_000);
  const frequency = finiteWithin(input.occurrencesPerWeek, 0, 7);
  const initial = finiteWithin(input.initialYen, 0, 10_000_000);
  const minutesBefore = finiteWithin(input.minutesBefore, 0, 1_440);
  const minutesAfter = finiteWithin(input.minutesAfter, 0, 1_440);
  const occurrencesPerYear = frequency * (365 / 7);
  const annualGrossSavings = before * occurrencesPerYear;
  const annualNetSavings = (before - after) * occurrencesPerYear;
  const annualHoursReclaimed = ((minutesBefore - minutesAfter) * occurrencesPerYear) / 60;
  const netAt = (years: number) => Math.round(annualNetSavings * years - initial);
  return {
    occurrencesPerYear,
    annualGrossSavings: Math.round(annualGrossSavings),
    annualNetSavings: Math.round(annualNetSavings),
    annualHoursReclaimed: Math.round(annualHoursReclaimed * 10) / 10,
    oneYearNet: netAt(1),
    fiveYearNet: netAt(5),
    tenYearNet: netAt(10),
    breakEvenMonths: annualNetSavings > 0
      ? Math.ceil((initial / annualNetSavings) * 12 * 10) / 10
      : null,
  };
}

export const habitRoiPresets: Record<string, HabitRoiInput & { label: string; note: string }> = {
  smoke: {
    label: '喫煙をやめる', note: '例：1日600円のたばこ代をゼロに',
    beforeYen: 600, afterYen: 0, occurrencesPerWeek: 7, initialYen: 20_000,
    minutesBefore: 0, minutesAfter: 0,
  },
  drink: {
    label: '飲み物を水筒に替える', note: '例：160円の購入を40円の自家製飲料に',
    beforeYen: 160, afterYen: 40, occurrencesPerWeek: 7, initialYen: 2_000,
    minutesBefore: 0, minutesAfter: 0,
  },
  snack: {
    label: 'コンビニ間食を見直す', note: '例：300円の間食を100円の代替食に',
    beforeYen: 300, afterYen: 100, occurrencesPerWeek: 5, initialYen: 0,
    minutesBefore: 0, minutesAfter: 0,
  },
  alcohol: {
    label: '飲酒の回数・量を減らす', note: '例：週4回500円を150円に置き換える',
    beforeYen: 500, afterYen: 150, occurrencesPerWeek: 4, initialYen: 0,
    minutesBefore: 0, minutesAfter: 0,
  },
  custom: {
    label: '自分の習慣を入力', note: '金額も回数も自由に変更できます',
    beforeYen: 300, afterYen: 0, occurrencesPerWeek: 7, initialYen: 0,
    minutesBefore: 0, minutesAfter: 0,
  },
};
