import type { APIContext } from 'astro';

interface Env {
  LINE_CHANNEL_SECRET?: string;
  LINE_CHANNEL_ACCESS_TOKEN?: string;
}

type LineSource = {
  type?: string;
  userId?: string;
};

type LineMessage = {
  type?: string;
  text?: string;
};

type LineEvent = {
  type?: string;
  replyToken?: string;
  source?: LineSource;
  message?: LineMessage;
};

type LineWebhookBody = {
  destination?: string;
  events?: LineEvent[];
};

const SITE_URL = 'https://masahiro-yamada.com';
const RESULT_CODE_RE = /([A-Z]{4}-\d+-\d+-\d+-\d+)/;

const encoder = new TextEncoder();

async function verifySignature(body: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));

  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) {
    diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return diff === 0;
}

async function reply(accessToken: string, replyToken: string, messages: string[]) {
  const res = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      replyToken,
      messages: messages.slice(0, 5).map((text) => ({ type: 'text', text })),
    }),
  });

  if (!res.ok) {
    console.error('LINE reply failed', res.status, await res.text());
  }
}

function normalize(text: string) {
  return text.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
}

function diagnosisStartMessages() {
  const url = `${SITE_URL}/trinity?utm_source=line&utm_medium=keyword&utm_campaign=diagnosis`;
  return [
    'ACE Trinity Diagnosisへようこそ。\n\nMBTI × 数秘 × エニアグラムの3方向から、今の認知パターンを立体的に見ていきます。',
    `▼ 診断はこちら\n${url}\n\n診断後は、結果画面のLINEボタンを押してください。診断コード入りのメッセージが自動入力されます。`,
  ];
}

function resultMessages(text: string) {
  const match = text.match(RESULT_CODE_RE);
  if (!match) {
    return [
      '診断コードが見つかりませんでした。\n\n結果画面に表示されるコードを付けて、\n「診断結果 ENFP-3-5-7-2」\nのように送ってください。',
    ];
  }

  const code = match[1];
  const url = `${SITE_URL}/trinity?r=${encodeURIComponent(code)}&u=1&utm_source=line&utm_medium=keyword&utm_campaign=deep_analysis`;
  return [
    `診断コードを受け取りました。\n${code}`,
    `▼ Trinity深層分析はこちら\n${url}\n\n結果を読んで「ここを現実で変えたい」と感じたら、このトークで「体験」と送ってください。`,
  ];
}

function trialMessages(text: string) {
  const code = text.match(RESULT_CODE_RE)?.[1];
  return [
    `ACE体験セッションですね。${code ? `\n診断コード：${code}` : ''}\n\n今の課題を整理して、「何を変えるか」ではなく「次に何をするか」まで一緒に落とします。`,
    'このまま以下を返信してください。\n\n① お名前\n② 今いちばん整理したいこと\n③ 希望日時（第1〜第3希望）\n\n内容を確認してこちらから返信します。',
  ];
}

function menuMessages() {
  return [
    'ACE LINE MENU\n\n「診断」→ Trinity Diagnosis\n「診断結果 + コード」→ 深層分析\n「体験」→ 体験セッション相談\n\n迷ったら「診断」と送ってください。',
  ];
}

function messagesForText(rawText: string) {
  const text = normalize(rawText);

  if (text === '診断' || text === '診断する') return diagnosisStartMessages();
  if (text.startsWith('診断結果')) return resultMessages(text);
  if (text === '体験' || text.startsWith('体験 ')) return trialMessages(text);
  if (text === 'メニュー' || text === 'menu' || text === 'MENU') return menuMessages();

  return [
    'メッセージありがとうございます。\n\nACEでは次のキーワードが使えます。\n\n「診断」\n「診断結果 + 診断コード」\n「体験」\n\nまずは「診断」と送ってみてください。',
  ];
}

export const POST = async ({ request, locals }: APIContext) => {
  const env = locals.runtime?.env as Env | undefined;
  const channelSecret = env?.LINE_CHANNEL_SECRET ?? '';
  const accessToken = env?.LINE_CHANNEL_ACCESS_TOKEN ?? '';
  const rawBody = await request.text();

  if (!channelSecret || !accessToken) {
    console.error('LINE webhook secrets are not configured');
    return new Response('LINE webhook is not configured', { status: 503 });
  }

  const signature = request.headers.get('x-line-signature') ?? '';
  if (!signature || !(await verifySignature(rawBody, signature, channelSecret))) {
    return new Response('Invalid signature', { status: 401 });
  }

  let payload: LineWebhookBody;
  try {
    payload = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // LINE's webhook verification request contains an empty events array.
  if (!payload.events?.length) {
    return new Response('OK', { status: 200 });
  }

  await Promise.all(
    payload.events.map(async (event) => {
      if (!event.replyToken) return;

      if (event.type === 'follow') {
        await reply(accessToken, event.replyToken, [
          '友だち追加ありがとうございます。\n\nまずは「診断」と送ってください。ACE Trinity Diagnosisをご案内します。',
        ]);
        return;
      }

      if (event.type === 'message' && event.message?.type === 'text') {
        await reply(accessToken, event.replyToken, messagesForText(event.message.text ?? ''));
      }
    }),
  );

  return new Response('OK', { status: 200 });
};
