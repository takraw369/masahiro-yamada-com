import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { routeVoiceCommand } from '../public/scripts/masa-voice-routes.mjs';

test('Japanese voice routing is bounded and deterministic', () => {
  assert.deepEqual(routeVoiceCommand('今日何する？'), { kind: 'today' });
  assert.deepEqual(routeVoiceCommand('カレンダーを開いて'), { kind: 'navigate', href: '/dashboard/schedule', label: 'Calendar' });
  assert.equal(routeVoiceCommand('画面をスクロールして').kind, 'device');
  assert.equal(routeVoiceCommand('Xに投稿して').kind, 'human_gate');
  assert.equal(routeVoiceCommand('本番反映して').kind, 'human_gate');
  assert.equal(routeVoiceCommand('経営戦略を整理して').kind, 'ask');
  assert.equal(routeVoiceCommand(''), { kind: 'empty' }.kind ? 'empty' : 'other');
  assert.equal(routeVoiceCommand('あ'.repeat(2001)).kind, 'too_long');
});

test('capture never saves a bare imperative as a knowledge item', () => {
  assert.deepEqual(routeVoiceCommand('慧、これ覚えて'), { kind: 'capture', text: '' });
  assert.deepEqual(routeVoiceCommand('覚えて：身体感覚を言語化する'), { kind: 'capture', text: '：身体感覚を言語化する' });
});

test('voice composer is owner-gated and routes only through existing APIs', async () => {
  const page = await readFile(new URL('../src/pages/dashboard/voice-commander.astro', import.meta.url), 'utf8');
  const client = await readFile(new URL('../public/scripts/masa-voice-commander.mjs', import.meta.url), 'utf8');
  const middleware = await readFile(new URL('../src/middleware.ts', import.meta.url), 'utf8');
  assert.match(page, /DashboardLayout/);
  assert.match(middleware, /pathname\.startsWith\('\/dashboard'\)/);
  assert.match(client, /\/api\/dashboard\/knowledge-ask/);
  assert.match(client, /\/api\/dashboard\/task-execution/);
  assert.match(client, /\/api\/dashboard\/knowledge/);
  assert.match(client, /credentials: 'same-origin'/);
  assert.match(client, /confirm-save/);
  assert.doesNotMatch(client, /localStorage|sessionStorage|SUPABASE_SERVICE_ROLE_KEY|owner_key|SpeechRecognition\(\)/);
  assert.doesNotMatch(client, /fetch\('https:/);
});
