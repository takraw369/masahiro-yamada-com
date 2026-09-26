export type XHealthLabelLevel = 'post' | 'account';

export interface XHealthLabelStat {
  level: XHealthLabelLevel;
  label: string;
  count: number;
  denominator: number | null;
  percentage: string | null;
  about: string;
  effect: string;
  legal: boolean;
}

export interface ParsedXHealthReport {
  reportMonth: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  generatedAt: string | null;
  postCount: number;
  postLabelCount: number;
  accountLabelDays: number;
  legalRestrictionCount: number;
  labels: XHealthLabelStat[];
  notes: string;
  rawReport: Record<string, unknown>;
}

const LEGAL_PATTERN = /(withheld|withhold|country|countries|legal|law\b|jurisdiction|法的|法律|国で|国から)/i;

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function nonNegativeInt(value: unknown): number {
  const parsed = finiteNumber(value);
  if (parsed === null) return 0;
  return Math.max(0, Math.round(parsed));
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function monthFromDate(value: unknown): string | null {
  const text = stringValue(value);
  const match = text.match(/^(\d{4})-(\d{2})/);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${match[1]}-${match[2]}` : null;
}

function maybeJsonObject(value: unknown): Record<string, unknown> | null {
  if (isObject(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return isObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function unwrapReport(input: Record<string, unknown>): Record<string, unknown> {
  const nested = maybeJsonObject(input.reportJson);
  if (nested) return nested;

  const data = isObject(input.data) ? input.data : null;
  const dataReport = data ? maybeJsonObject(data.reportJson) : null;
  if (dataReport) return dataReport;

  return input;
}

function isLegalLabel(row: Record<string, unknown>) {
  const haystack = [row.label, row.about, row.effect, row.reason, row.countryCodes]
    .map((part) => {
      if (Array.isArray(part)) return part.join(' ');
      return typeof part === 'string' ? part : '';
    })
    .join(' ');
  return LEGAL_PATTERN.test(haystack);
}

function normalizeLabelRow(row: unknown, level: XHealthLabelLevel): XHealthLabelStat | null {
  if (!isObject(row)) return null;
  const label = stringValue(row.label ?? row.name ?? row.labelName);
  if (!label) return null;

  const count = level === 'post'
    ? nonNegativeInt(row.posts ?? row.count ?? row.postCount)
    : nonNegativeInt(row.days ?? row.count ?? row.dayCount);

  const denominatorValue = level === 'post'
    ? finiteNumber(row.totalPostsInMonth ?? row.totalPosts ?? row.denominator)
    : finiteNumber(row.daysInPeriod ?? row.totalDays ?? row.denominator);

  return {
    level,
    label,
    count,
    denominator: denominatorValue === null ? null : Math.max(0, Math.round(denominatorValue)),
    percentage: stringValue(row.percentageOfPosts ?? row.percentageOfDays ?? row.percentage) || null,
    about: stringValue(row.about),
    effect: stringValue(row.effect),
    legal: isLegalLabel(row),
  };
}

function sumLabels(labels: XHealthLabelStat[], level: XHealthLabelLevel) {
  return labels
    .filter((label) => label.level === level)
    .reduce((sum, label) => sum + label.count, 0);
}

export function parseXUnderTheHoodReport(input: unknown): ParsedXHealthReport {
  if (!isObject(input)) throw new Error('XのJSONはオブジェクト形式で貼り付けてください。');
  const rawReport = unwrapReport(input);

  const period = isObject(rawReport.period) ? rawReport.period : {};
  const periodStart = stringValue(period.startDate) || null;
  const periodEnd = stringValue(period.endDate) || null;
  const reportMonth = monthFromDate(period.startDate) ?? monthFromDate(period.endDate) ?? monthFromDate(rawReport.generatedAt);

  if (
    !monthFromDate(period.startDate) ||
    (periodEnd && monthFromDate(periodEnd) !== reportMonth) ||
    finiteNumber(rawReport.postCount ?? rawReport.totalPostsInMonth ?? rawReport.totalPosts) === null ||
    !Array.isArray(rawReport.postLabels) ||
    !Array.isArray(rawReport.accountLabels)
  ) {
    throw new Error('対象月・投稿数・ラベル一覧を含むX公式のレポートJSONを貼り付けてください。');
  }

  const postLabels = Array.isArray(rawReport.postLabels)
    ? rawReport.postLabels.map((row) => normalizeLabelRow(row, 'post')).filter((row): row is XHealthLabelStat => Boolean(row))
    : [];
  const accountLabels = Array.isArray(rawReport.accountLabels)
    ? rawReport.accountLabels.map((row) => normalizeLabelRow(row, 'account')).filter((row): row is XHealthLabelStat => Boolean(row))
    : [];
  const labels = [...postLabels, ...accountLabels];

  const postCount = nonNegativeInt(rawReport.postCount ?? rawReport.totalPostsInMonth ?? rawReport.totalPosts);
  const explicitPostLabels = finiteNumber(rawReport.totalPostLabels);
  const explicitAccountLabels = finiteNumber(rawReport.totalAccountLabelDays);
  const postLabelCount = explicitPostLabels === null
    ? sumLabels(labels, 'post')
    : Math.max(0, Math.round(explicitPostLabels));
  const accountLabelDays = explicitAccountLabels === null
    ? sumLabels(labels, 'account')
    : Math.max(0, Math.round(explicitAccountLabels));
  const legalRestrictionCount = labels.filter((label) => label.legal).length;

  return {
    reportMonth,
    periodStart,
    periodEnd,
    generatedAt: stringValue(rawReport.generatedAt) || null,
    postCount,
    postLabelCount,
    accountLabelDays,
    legalRestrictionCount,
    labels,
    notes: stringValue(rawReport.notes),
    rawReport,
  };
}

export function xHealthLabelRate(report: Pick<ParsedXHealthReport, 'postCount' | 'postLabelCount'>) {
  if (report.postCount <= 0) return 0;
  return report.postLabelCount / report.postCount;
}
