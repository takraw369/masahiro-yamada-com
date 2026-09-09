// Evidence only: no inferred run, retry, due time or historical sequence labels.
type RecordValue = Record<string, unknown>;
export type LineMessageEvidence = {
  direction: string;
  message_id?: string | null;
  contact_id?: string | null;
  why_sent?: RecordValue | null;
};
const record = (value: unknown): RecordValue =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {};
const captured = (value: unknown): string =>
  typeof value === 'string' && value.trim() ? value :
    typeof value === 'number' && Number.isFinite(value) ? String(value) : 'Not captured';

export function duplicateCandidates(message: LineMessageEvidence): string[] {
  if (message.direction !== 'outbound') return [];
  const ids = record(message.why_sent).duplicate_candidate_message_ids;
  return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && /^\d+$/.test(id)).slice(0, 5) : [];
}

export function whySentRows(message: LineMessageEvidence): [string, string][] {
  if (message.direction !== 'outbound') return [];
  const why = record(message.why_sent);
  const guard = record(why.idempotency);
  return [
    ['Message', message.message_id],
    ['Contact ID', message.contact_id],
    ['Delivery reason', why.delivery_reason],
    ['Sequence key (recorded)', why.sequence_key],
    ['Sequence name (current)', why.sequence_name],
    ['Sequence ID', why.sequence_id],
    ['Step index (recorded)', why.step_index],
    ['Step name (current)', why.step_name],
    ['Step ID', why.step_id],
    ['Enrollment', why.enrollment_id],
    ['Trigger (recorded)', why.trigger_source],
    ['Automation (recorded)', why.automation],
    ['Execution ID', why.execution_id],
    ['Scheduled / due', why.scheduled_for],
    ['Delivery mode', why.delivery_mode],
    ['Idempotency guard', guard.guard_id],
    ['Idempotency message key', guard.message_key],
    ['Idempotency date (JST)', guard.delivery_date],
    ['Guard status (current)', guard.status],
    ['Guard reason', guard.reason],
    ['Guard claimed at', guard.claimed_at],
    ['Guard sent at', guard.sent_at],
    ['Request group (not execution)', why.request_group_id],
    ['Attempt / retry', why.attempt],
    ['LINE API result', why.line_api_result],
  ].map(([label, value]) => [String(label), captured(value)]);
}
