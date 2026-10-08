import type { APIContext } from 'astro';
import {
  getDashboardOwnerKey,
  getSiteStorageEnv,
  supabaseRpc,
} from '../../../lib/siteStorage';
import { parseXUnderTheHoodReport } from '../../../lib/xHealth';

type StoredRow = {
  account_id: string;
  username: string;
  report_month: string;
  post_count: number;
  post_label_count: number;
  account_label_days: number;
  legal_restriction_count: number;
  labels: unknown[];
  raw_report: Record<string, unknown>;
  imported_at: string;
  updated_at: string;
};

const headers = { 'Content-Type': 'application/json' };
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers });
}

function cleanString(value: unknown, max: number) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function nonNegativeInt(value: unknown, max = 1_000_000_000) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > max) return null;
  return rounded;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export const GET = async ({ locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  try {
    const ownerKey = await getDashboardOwnerKey(env);
    const rows = await supabaseRpc<StoredRow[]>(env, 'masa_x_health_reports_get_v1', {
      p_owner_key: ownerKey,
    });

    return json({
      ok: true,
      storage: 'supabase',
      reports: (rows ?? []).map((row) => ({
        accountId: row.account_id,
        username: row.username,
        reportMonth: row.report_month,
        postCount: row.post_count,
        postLabelCount: row.post_label_count,
        accountLabelDays: row.account_label_days,
        legalRestrictionCount: row.legal_restriction_count,
        labels: Array.isArray(row.labels) ? row.labels : [],
        rawReport: isObject(row.raw_report) ? row.raw_report : {},
        importedAt: row.imported_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    return json({ ok: false, error: 'x_health_read_unavailable', detail: String(error) }, 503);
  }
};

export const POST = async ({ request, locals }: APIContext) => {
  const env = getSiteStorageEnv(locals);
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!isObject(parsed)) throw new Error('invalid_body');
    body = parsed;
  } catch {
    return json({ ok: false, error: 'invalid_json' }, 400);
  }

  const accountId = cleanString(body.accountId, 180);
  const username = cleanString(body.username, 100).replace(/^@/, '');
  const reportMonth = cleanString(body.reportMonth, 7);
  const postCount = nonNegativeInt(body.postCount);
  const postLabelCount = nonNegativeInt(body.postLabelCount);
  const accountLabelDays = nonNegativeInt(body.accountLabelDays);
  const legalRestrictionCount = nonNegativeInt(body.legalRestrictionCount, 10_000);
  const labels = Array.isArray(body.labels) ? body.labels.slice(0, 200) : null;
  const rawReport = isObject(body.rawReport) ? body.rawReport : null;

  if (
    !accountId || !monthPattern.test(reportMonth) || postCount === null ||
    postLabelCount === null || accountLabelDays === null || legalRestrictionCount === null ||
    !labels || !rawReport
  ) {
    return json({ ok: false, error: 'invalid_x_health_report' }, 400);
  }

  const labelsSize = JSON.stringify(labels).length;
  const rawSize = JSON.stringify(rawReport).length;
  if (labelsSize > 180_000 || rawSize > 450_000) {
    return json({ ok: false, error: 'x_health_report_too_large' }, 413);
  }

  try {
    const parsed = parseXUnderTheHoodReport(rawReport);
    if (
      parsed.reportMonth !== reportMonth || parsed.postCount !== postCount ||
      parsed.postLabelCount !== postLabelCount || parsed.accountLabelDays !== accountLabelDays ||
      parsed.legalRestrictionCount !== legalRestrictionCount ||
      JSON.stringify(parsed.labels) !== JSON.stringify(labels)
    ) throw new Error('report_mismatch');
  } catch {
    return json({ ok: false, error: 'invalid_x_health_report' }, 400);
  }

  try {
    const ownerKey = await getDashboardOwnerKey(env);
    await supabaseRpc<boolean>(env, 'masa_x_health_report_upsert_v1', {
      p_owner_key: ownerKey,
      p_account_id: accountId,
      p_username: username,
      p_report_month: reportMonth,
      p_post_count: postCount,
      p_post_label_count: postLabelCount,
      p_account_label_days: accountLabelDays,
      p_legal_restriction_count: legalRestrictionCount,
      p_labels: labels,
      p_raw_report: rawReport,
    });

    return json({ ok: true, storage: 'supabase' });
  } catch (error) {
    return json({ ok: false, error: 'x_health_write_unavailable', detail: String(error) }, 503);
  }
};
