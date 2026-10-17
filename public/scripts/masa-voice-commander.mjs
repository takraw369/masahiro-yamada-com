import { routeVoiceCommand } from './masa-voice-routes.mjs';

const input = document.querySelector('#command-text');
const listenButton = document.querySelector('#listen');
const runButton = document.querySelector('#run-command');
const saveButton = document.querySelector('#confirm-save');
const copyButton = document.querySelector('#copy-response');
const speakButton = document.querySelector('#speak-response');
const responseNode = document.querySelector('#assistant-response');
const stateNode = document.querySelector('#voice-state');
const linkNode = document.querySelector('#next-link');
const captureNode = document.querySelector('#capture-preview');
let savingText = '';
let latestResponse = '';
let busy = false;
let recognizer = null;

function status(message) { stateNode.textContent = message; }
function output(message) {
  latestResponse = String(message ?? '');
  responseNode.textContent = latestResponse;
  copyButton.disabled = !latestResponse;
  speakButton.disabled = !latestResponse;
}
function reviewClear() {
  savingText = '';
  captureNode.textContent = '';
  saveButton.hidden = true;
  linkNode.hidden = true;
  linkNode.removeAttribute('href');
}
function nextLink(label, href) {
  linkNode.textContent = label + 'を開く →';
  linkNode.href = href;
  linkNode.hidden = false;
}
function speak(text) {
  if (!('speechSynthesis' in window)) {
    status('この環境では読み上げを利用できません');
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.slice(0, 900));
  utterance.lang = 'ja-JP';
  utterance.rate = 1;
  window.speechSynthesis.speak(utterance);
}
async function jsonResponse(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (response.status === 401) throw new Error('ログインが必要です。Dashboardからログインしてください。');
  if (!response.ok) throw new Error('既存のMASA OSに接続できませんでした。');
  const data = await response.json();
  if (!data?.ok) throw new Error('MASA OSから有効な応答がありませんでした。');
  return data;
}
async function taskSummary() {
  const payload = await jsonResponse('/api/dashboard/task-execution?limit=120');
  const items = Array.isArray(payload.items) ? payload.items : [];
  const active = items.filter((item) => ['NOW', 'NEXT', 'REVIEW'].includes(item.status));
  const ordered = active.sort((a, b) => {
    const score = (x) => x === 'P0' ? 0 : x === 'P1' ? 1 : x === 'P2' ? 2 : 3;
    return score(a.priority) - score(b.priority);
  });
  const top = ordered.slice(0, 3);
  const lines = top.map((item, i) =>
    String(i + 1) + '．' + String(item.task || '無題').slice(0, 120) +
    (item.nextAction ? '。次：' + String(item.nextAction).slice(0, 130) : '')
  );
  output('MASA TASK BOARD由来の現在のタスク上位' + top.length + '件。\n' +
    (lines.length ? lines.join('\n') : 'NOW/NEXT/REVIEWのタスクは見つかりませんでした。') +
    '\n※カレンダーの予定とは別です。予定はCalendarで確認してください。');
  nextLink('Task Flow', '/dashboard/tasks');
}
async function askKnowledge(question) {
  const payload = await jsonResponse('/api/dashboard/knowledge-ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ question, answerMode: 'ai' }),
  });
  const answer = typeof payload.answer === 'string' ? payload.answer : '';
  const sources = Array.isArray(payload.sources) ? payload.sources : [];
  output((answer || '回答が取得できませんでした。') +
    (sources.length ? '\n\n出典：' + sources.slice(0, 3).map((s) => String(s.title || 'Source')).join(' / ') : '\n\n出典は提示されていません。'));
  nextLink('Knowledge OS', '/dashboard/knowledge');
}
async function run() {
  if (busy) return;
  const command = input.value.trim();
  if (!command) return status('話すか入力してから「実行内容を確認」を押してください');
  window.speechSynthesis?.cancel();
  reviewClear();
  const parsed = routeVoiceCommand(command);
  if (parsed.kind === 'empty') return;
  if (parsed.kind === 'too_long') return status('音声指示は2000文字以内にしてください');
  if (parsed.kind === 'human_gate') {
    output('これはHuman Gate対象です。音声のみでは実行しません。既存Dashboardの承認フローで確認してください。');
    status('実行なし · 安全停止');
    return;
  }
  if (parsed.kind === 'device') {
    output('iPhone本体の操作は「設定 → アクセシビリティ → 音声コントロール」で行います。たとえば「下にスクロール」「項目名をタップ」と声で操作できます。このWeb画面からiOS全体を直接操作することはできません。');
    status('iPhone標準機能へ案内 · 操作なし');
    return;
  }
  if (parsed.kind === 'navigate') {
    output('移動先：' + parsed.label + '。確認してからリンクをタップしてください。');
    nextLink(parsed.label, parsed.href);
    status('画面移動は本人のタップ待ち');
    return;
  }
  if (parsed.kind === 'capture') {
    if (!parsed.text) {
      output('何を残したいか、内容を続けて話すか入力してください。例：「記録して 今日の気づきは……」');
      status('内容待ち · 保存なし');
      return;
    }
    savingText = parsed.text;
    captureNode.textContent = parsed.text;
    saveButton.hidden = false;
    output('この内容を、既存のprivate Knowledgeへ保存する候補にしました。確認して「保存を確定」を押してください。正式なDrive正本への資産化は別途Reviewが必要です。');
    status('Human Gate · 保存前の確認');
    return;
  }
  busy = true;
  runButton.disabled = true;
  status('既存MASA OSを照会中…');
  try {
    if (parsed.kind === 'today') await taskSummary();
    else await askKnowledge(parsed.question);
    status('照会完了 · 保存・公開操作なし');
  } catch (error) {
    output(error instanceof Error ? error.message : '通信に失敗しました。');
    status('失敗 · 未実行');
  } finally {
    busy = false;
    runButton.disabled = false;
  }
}
listenButton.addEventListener('click', () => {
  if (recognizer) {
    recognizer.stop();
    return;
  }
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    status('ブラウザ音声認識が利用できません。iPhoneのキーボードのマイクで入力してください。');
    input.focus();
    return;
  }
  recognizer = new Recognition();
  recognizer.lang = 'ja-JP';
  recognizer.continuous = false;
  recognizer.interimResults = false;
  recognizer.onresult = (event) => {
    const transcript = event.results?.[0]?.[0]?.transcript || '';
    input.value = String(transcript).slice(0, 2000);
    status('文字起こしを確認して実行してください · 自動実行なし');
  };
  recognizer.onerror = () => status('音声認識に失敗しました。キーボードのマイクでも入力できます。');
  recognizer.onend = () => {
    recognizer = null;
    listenButton.textContent = '🎙 話す';
  };
  try {
    recognizer.start();
    listenButton.textContent = '■ 停止';
    status('音声を聞き取っています。録音データはこの画面では保存しません。');
  } catch {
    recognizer = null;
    status('音声認識を開始できませんでした。キーボードのマイクを使ってください。');
  }
});
runButton.addEventListener('click', run);
input.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { event.preventDefault(); void run(); }
});
saveButton.addEventListener('click', async () => {
  if (busy || !savingText) return;
  // Never silently write to Drive, the task board, external messaging, or social networks.
  busy = true;
  saveButton.disabled = true;
  status('private Knowledgeに保存中…');
  try {
    await jsonResponse('/api/dashboard/knowledge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ text: savingText }),
    });
    output('private Knowledgeへの保存が完了しました。Drive正本への資産化は未実施です。');
    status('private Knowledge保存済み · Drive反映は別途Review');
    reviewClear();
    nextLink('FLOW MIND', '/mind');
  } catch (error) {
    output(error instanceof Error ? error.message : '保存に失敗しました。');
    status('未保存 · 再試行できます');
  } finally {
    busy = false;
    saveButton.disabled = false;
  }
});
copyButton.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(latestResponse);
    status('回答をコピーしました');
  } catch { status('コピーできませんでした。テキストを選択してコピーしてください。'); }
});
speakButton.addEventListener('click', () => speak(latestResponse));
status('待機中 · 音声/文字入力どちらも利用できます');
