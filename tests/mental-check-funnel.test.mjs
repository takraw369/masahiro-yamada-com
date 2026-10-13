import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const page = read('../src/pages/mental-check.astro');
const questionnaire = read('../src/pages/api/questionnaire/mental.ts');
const clickApi = read('../src/pages/api/funnel/mental-check.ts');
const sql = read('../migrations/20261013_mental_check_funnel_events_v1.sql');

test('analytics never bypasses successful persisted questionnaire response or consent', () => {
  assert.ok(questionnaire.indexOf("'submit_questionnaire_v1'") < questionnaire.indexOf("'mental_check_funnel_event_add_v1'"));
  assert.match(questionnaire, /typeof data\.session_id === 'string'/);
  assert.match(questionnaire, /p_event_name: 'mental_check_completed'/);
  assert.match(questionnaire, /console\.warn\('mental_check_completion_event_unavailable'\)/);
  assert.match(questionnaire, /p_followup_consent: body\.followupConsent === true/);
  assert.match(page, /if \(!res\.ok \|\| !body\.ok\) throw new Error/);
  assert.ok(page.indexOf('submittedSuccessfully = true;') > page.indexOf("throw new Error(body.error || 'submit_failed')"));
  assert.match(page, /sessionStorage\.removeItem\('mental-check-session'\)/);
});

test('CTA events use the final rendered destinations, never a guessed conversion', () => {
  assert.match(page, /if \(!submittedSuccessfully\) return;/);
  assert.match(page, /destination\.startsWith\('https:\/\/lin\.ee\/pcAHpTBy'\)/);
  assert.match(page, /destination === '\/library\/entry-toolkit'/);
  assert.match(page, /mental_check_line_click/);
  assert.match(page, /mental_check_toolkit_click/);
  assert.match(page, /keepalive: true/);
  assert.match(page, /\.catch\(\(\) => \{\}\)/);
  assert.doesNotMatch(page, /fetch\('\/api\/funnel\/mental-check'[\s\S]*?JSON\.stringify\(\{[^}]*answers/);
});

test('click endpoint rejects cross-origin, invalid requests and unverified sessions', () => {
  assert.match(clickApi, /origin !== new URL\(request\.url\)\.origin/);
  assert.match(clickApi, /ALLOWED = new Set\(\['mental_check_line_click', 'mental_check_toolkit_click'\]\)/);
  assert.match(clickApi, /UUID\.test\(sessionKey\)/);
  assert.match(clickApi, /session_not_found/);
  assert.doesNotMatch(clickApi, /p_answers|p_email|p_display_name/);
});

test('SQL only logs real completed sessions to existing ledger, with consent-safe contact linking and retry dedupe', () => {
  assert.match(sql, /from public\.answer_sessions s/);
  assert.match(sql, /s\.status = 'completed'/);
  assert.match(sql, /qs\.set_key = 'mental_condition_lead_v1'/);
  assert.match(sql, /s\.consent_scope = 'marketing_followup'/);
  assert.match(sql, /pg_catalog\.pg_advisory_xact_lock/);
  assert.match(sql, /e\.payload->>'answer_session_id' = v_session_id::text/);
  assert.match(sql, /insert into public\.funnel_events/);
  assert.match(sql, /revoke all on function/);
  assert.match(sql, /grant execute on function/);
  assert.doesNotMatch(sql, /create table|p_email|response_value|answer_events|p_person_id/i);
});
