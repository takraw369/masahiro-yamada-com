import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const page = readFileSync(new URL('../src/pages/dashboard/tasks.astro', import.meta.url), 'utf8');
const cockpit = readFileSync(new URL('../src/components/dashboard/DashboardCockpit.tsx', import.meta.url), 'utf8');
const functionStart = page.indexOf('function buildTaskGptPrompt(');
const functionEnd = page.indexOf('function setTaskGptMode(');
assert.ok(functionStart >= 0 && functionEnd > functionStart);
const buildPrompt = new Function(`${page.slice(functionStart, functionEnd)}\nreturn buildTaskGptPrompt;`)();

const task = {
  taskId: 'T0042',
  task: '乙4の鑑別を練習する',
  project: 'ACE',
  status: 'NOW',
  priority: 'P0',
  nextAction: '画像から問題を10問出す',
  executionLane: 'AI_RUN',
  sourceRevision: 3,
};

test('start handoff carries task context and gates irreversible actions', () => {
  const prompt = buildPrompt(task, 'start');
  assert.match(prompt, /Task ID: T0042/);
  assert.match(prompt, /Task: 乙4の鑑別を練習する/);
  assert.match(prompt, /Next action: 画像から問題を10問出す/);
  assert.match(prompt, /【依頼：着手モード】/);
  assert.match(prompt, /明示的な承認/);
  assert.doesNotMatch(prompt, /undefined|null/);
});

test('consult handoff uses separate decision framework without inventing absent data', () => {
  const prompt = buildPrompt({ taskId:'T0001', task:'確認する', dueDate:null }, 'consult');
  assert.match(prompt, /【依頼：相談モード】/);
  assert.match(prompt, /第一推奨/);
  assert.match(prompt, /Purpose → Outcome → Current State → Next Action/);
  assert.doesNotMatch(prompt, /Due date:|undefined|null/);
  assert.doesNotMatch(prompt, /【依頼：着手モード】/);
});

test('task cards and cockpit links launch handoff without modifying read model', () => {
  assert.ok(page.includes('role="button" tabindex="0" data-task-id='));
  assert.ok(page.includes("list.addEventListener('keydown'"));
  assert.ok(page.includes('openPendingTaskLink();'));
  assert.ok(page.includes('navigator.clipboard.writeText'));
  assert.ok(page.includes('https://chatgpt.com/'));
  assert.ok(!page.includes('https://chatgpt.com/?q='));
  assert.ok(cockpit.includes('encodeURIComponent(primaryTask.taskId)'));
  assert.ok(cockpit.includes('encodeURIComponent(item.taskId)'));
});
