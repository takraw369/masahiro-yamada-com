import { useEffect, useMemo, useRef, useState } from 'react';

type RpcId = number | string;
type JsonMap = Record<string, any>;
type ConnectionState = 'disconnected' | 'connecting' | 'ready' | 'error';

type PendingCall = {
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  method: string;
};

type ApprovalRequest = {
  id: RpcId;
  method: string;
  params: JsonMap;
};

type LogEntry = {
  at: string;
  method: string;
  summary: string;
};

const DEFAULT_BRIDGE = 'http://127.0.0.1:4510';
const STORAGE_KEY = 'masa-codex-dashboard-bridge';

function nowLabel() {
  return new Intl.DateTimeFormat('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date());
}

function stringify(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function compact(value: unknown, limit = 180) {
  const text = typeof value === 'string' ? value : stringify(value).replace(/\s+/g, ' ');
  return text.length > limit ? `${text.slice(0, limit)}…` : text;
}

function approvalLabel(method: string) {
  if (method.includes('commandExecution')) return 'Command approval';
  if (method.includes('fileChange')) return 'File change approval';
  if (method.includes('permissions')) return 'Permission approval';
  return 'Human Gate';
}

function normalizeBase(value: string) {
  return value.trim().replace(/\/$/, '');
}

export default function CodexAppServerPanel() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const bridgeRef = useRef(DEFAULT_BRIDGE);
  const pendingRef = useRef(new Map<RpcId, PendingCall>());
  const requestIdRef = useRef(0);

  const [bridge, setBridge] = useState(DEFAULT_BRIDGE);
  const [connection, setConnection] = useState<ConnectionState>('disconnected');
  const [connectionError, setConnectionError] = useState('');
  const [threadId, setThreadId] = useState('');
  const [turnId, setTurnId] = useState('');
  const [task, setTask] = useState('このリポジトリを確認し、今の構成を壊さずに改善できる小さな変更を1つ提案してください。実装前に必要ならHuman Gateを要求してください。');
  const [assistantText, setAssistantText] = useState('');
  const [turnStatus, setTurnStatus] = useState('idle');
  const [approvals, setApprovals] = useState<ApprovalRequest[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [rawVisible, setRawVisible] = useState(false);
  const [lastRaw, setLastRaw] = useState('');

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      setBridge(saved);
      bridgeRef.current = saved;
    }
    return () => {
      eventSourceRef.current?.close();
      pendingRef.current.forEach(({ reject }) => reject(new Error('Dashboard bridge disconnected')));
      pendingRef.current.clear();
    };
  }, []);

  const isReady = connection === 'ready';
  const canRun = isReady && Boolean(threadId) && task.trim().length > 0 && turnStatus !== 'running';

  const addLog = (method: string, summary: unknown) => {
    setLogs((current) => [
      { at: nowLabel(), method, summary: compact(summary) },
      ...current,
    ].slice(0, 80));
  };

  const postRpc = async (payload: JsonMap) => {
    const response = await fetch(`${bridgeRef.current}/rpc`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', ...payload }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body?.error || `Bridge RPC failed (${response.status})`);
    }
  };

  const send = async (payload: JsonMap) => {
    await postRpc(payload);
  };

  const call = (method: string, params: JsonMap = {}) => {
    const id = ++requestIdRef.current;
    return new Promise<any>((resolve, reject) => {
      pendingRef.current.set(id, { resolve, reject, method });
      addLog(`→ ${method}`, params);
      postRpc({ id, method, params }).catch((error) => {
        pendingRef.current.delete(id);
        reject(error);
        addLog(`✕ ${method}`, error instanceof Error ? error.message : String(error));
      });
    });
  };

  const handleNotification = (method: string, params: JsonMap) => {
    addLog(`← ${method}`, params);

    if (method === 'thread/started') {
      const id = params?.thread?.id;
      if (typeof id === 'string') setThreadId(id);
      return;
    }

    if (method === 'turn/started') {
      const id = params?.turn?.id;
      if (typeof id === 'string') setTurnId(id);
      setTurnStatus('running');
      return;
    }

    if (method === 'item/agentMessage/delta' && typeof params?.delta === 'string') {
      setAssistantText((current) => current + params.delta);
      return;
    }

    if (method === 'turn/completed') {
      const status = params?.turn?.status;
      setTurnStatus(typeof status === 'string' ? status : 'completed');
      return;
    }

    if (method === 'serverRequest/resolved') {
      const requestId = params?.requestId;
      if (requestId !== undefined) {
        setApprovals((current) => current.filter((item) => String(item.id) !== String(requestId)));
      }
    }
  };

  const handleRawMessage = (raw: string) => {
    let message: JsonMap;
    try {
      message = JSON.parse(raw);
    } catch {
      addLog('parse/error', raw);
      return;
    }

    setLastRaw(stringify(message));

    if ('id' in message && 'method' in message) {
      const request: ApprovalRequest = {
        id: message.id,
        method: String(message.method),
        params: message.params ?? {},
      };
      addLog(`⇠ ${request.method}`, request.params);
      setApprovals((current) => {
        if (current.some((item) => String(item.id) === String(request.id))) return current;
        return [...current, request];
      });
      return;
    }

    if ('id' in message && !('method' in message)) {
      const pending = pendingRef.current.get(message.id);
      if (!pending) return;
      pendingRef.current.delete(message.id);
      if (message.error) {
        pending.reject(new Error(message.error?.message ?? stringify(message.error)));
        addLog(`✕ ${pending.method}`, message.error);
      } else {
        pending.resolve(message.result);
        addLog(`✓ ${pending.method}`, message.result);
      }
      return;
    }

    if ('method' in message) {
      handleNotification(String(message.method), message.params ?? {});
    }
  };

  const resetSessionState = () => {
    pendingRef.current.forEach(({ reject }) => reject(new Error('Codex session reset')));
    pendingRef.current.clear();
    setThreadId('');
    setTurnId('');
    setAssistantText('');
    setTurnStatus('idle');
    setApprovals([]);
  };

  const connect = async () => {
    eventSourceRef.current?.close();
    resetSessionState();
    setConnection('connecting');
    setConnectionError('');

    const base = normalizeBase(bridge);
    bridgeRef.current = base;
    setBridge(base);
    window.localStorage.setItem(STORAGE_KEY, base);

    try {
      const health = await fetch(`${base}/health`);
      if (!health.ok) throw new Error(`Local bridge is not ready (${health.status})`);

      const events = new EventSource(`${base}/events`);
      eventSourceRef.current = events;

      await new Promise<void>((resolve, reject) => {
        const timer = window.setTimeout(() => reject(new Error('Event stream connection timed out.')), 3500);
        events.onopen = () => {
          window.clearTimeout(timer);
          resolve();
        };
        events.onerror = () => {
          window.clearTimeout(timer);
          reject(new Error('Local event stream could not be opened.'));
        };
      });

      events.onmessage = (event) => handleRawMessage(event.data);
      events.onerror = () => {
        setConnectionError('Local bridge event stream was interrupted. Restart npm run codex:bridge and reconnect.');
      };

      const session = await fetch(`${base}/session`, { method: 'POST' });
      if (!session.ok) {
        const body = await session.json().catch(() => ({}));
        throw new Error(body?.error || `Could not open Codex session (${session.status})`);
      }

      await call('initialize', {
        clientInfo: {
          name: 'masa-os-dashboard',
          title: 'MASA OS Codex Agent',
          version: '0.1.0',
        },
        capabilities: {
          experimentalApi: true,
          requestAttestation: false,
        },
      });
      await send({ method: 'initialized' });
      addLog('→ initialized', 'handshake complete');
      setConnection('ready');
    } catch (error) {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      const message = error instanceof Error ? error.message : String(error);
      setConnection('error');
      setConnectionError(`${message} 先に npm run codex:bridge を起動してください。`);
    }
  };

  const disconnect = () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    resetSessionState();
    setConnection('disconnected');
    setConnectionError('');
  };

  const startThread = async () => {
    if (!isReady) return;
    setConnectionError('');
    try {
      const result = await call('thread/start', {
        approvalPolicy: 'on-request',
        approvalsReviewer: 'user',
        sandbox: 'workspace-write',
      });
      const id = result?.thread?.id;
      if (!id) throw new Error('thread/start response did not include thread.id');
      setThreadId(id);
      setAssistantText('');
      setTurnStatus('idle');
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
    }
  };

  const runTask = async () => {
    if (!canRun) return;
    setConnectionError('');
    setAssistantText('');
    setTurnStatus('running');
    try {
      const result = await call('turn/start', {
        threadId,
        input: [{ type: 'text', text: task.trim() }],
      });
      const id = result?.turn?.id;
      if (typeof id === 'string') setTurnId(id);
    } catch (error) {
      setTurnStatus('failed');
      setConnectionError(error instanceof Error ? error.message : String(error));
    }
  };

  const interruptTurn = async () => {
    if (!isReady || !threadId || !turnId) return;
    try {
      await call('turn/interrupt', { threadId, turnId });
      setTurnStatus('interrupted');
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
    }
  };

  const answerApproval = async (request: ApprovalRequest, decision: 'accept' | 'decline' | 'cancel') => {
    if (!isReady) return;
    try {
      await send({ id: request.id, result: { decision } });
      addLog(`→ approval/${decision}`, { id: request.id, method: request.method });
      setApprovals((current) => current.filter((item) => String(item.id) !== String(request.id)));
    } catch (error) {
      setConnectionError(error instanceof Error ? error.message : String(error));
    }
  };

  const stateLabel = useMemo(() => ({
    disconnected: 'OFFLINE',
    connecting: 'CONNECTING',
    ready: 'READY',
    error: 'ERROR',
  }[connection]), [connection]);

  return (
    <div className="codex-grid">
      <section className="panel connection-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">LOCAL BRIDGE</p>
            <h2>Codex App Server</h2>
          </div>
          <span className={`state state-${connection}`}>{stateLabel}</span>
        </div>

        <label className="field">
          <span>Bridge endpoint</span>
          <input value={bridge} onChange={(event) => setBridge(event.target.value)} spellCheck={false} />
        </label>

        <div className="actions">
          {!isReady ? <button className="primary" onClick={connect}>Connect</button> : <button onClick={disconnect}>Disconnect</button>}
          <button onClick={startThread} disabled={!isReady}>New thread</button>
        </div>

        <div className="ids">
          <div><span>THREAD</span><code>{threadId || '—'}</code></div>
          <div><span>TURN</span><code>{turnId || '—'}</code></div>
        </div>

        {connectionError && <p className="error-box">{connectionError}</p>}

        <details className="setup" open>
          <summary>起動方法</summary>
          <div>
            <p>Terminal 1。ローカルブリッジを起動。必要ならCodex App Serverも自動起動します。</p>
            <code>npm run codex:bridge</code>
            <p>Terminal 2。Dashboardをローカル起動。</p>
            <code>npm run dev</code>
            <p>その後 <code>http://localhost:4321/dashboard/codex</code> を開いてConnect。</p>
            <p className="note">Bridge 4510 / App Server 4500 はどちらも127.0.0.1だけにbindします。外部公開しません。</p>
          </div>
        </details>
      </section>

      <section className="panel task-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">TASK</p>
            <h2>Agentへ渡す</h2>
          </div>
          <span className={`turn-status status-${turnStatus}`}>{turnStatus}</span>
        </div>

        <textarea value={task} onChange={(event) => setTask(event.target.value)} rows={7} />
        <div className="actions">
          <button className="primary" onClick={runTask} disabled={!canRun}>Run</button>
          <button onClick={interruptTurn} disabled={turnStatus !== 'running' || !turnId}>Interrupt</button>
        </div>

        <div className="assistant-output" aria-live="polite">
          <div className="output-label">CODEX</div>
          <div className="output-body">{assistantText || 'Agentの返答がここにストリームされます。'}</div>
        </div>
      </section>

      <section className="panel gate-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">HUMAN GATE</p>
            <h2>承認待ち</h2>
          </div>
          <span className="count">{approvals.length}</span>
        </div>

        {approvals.length === 0 ? (
          <div className="empty-state">承認要求はまだありません。sandbox境界を越える操作が必要になるとここに出ます。</div>
        ) : (
          <div className="approval-list">
            {approvals.map((request) => (
              <article className="approval-card" key={`${request.method}:${request.id}`}>
                <div className="approval-title">
                  <strong>{approvalLabel(request.method)}</strong>
                  <code>#{String(request.id)}</code>
                </div>
                <p>{request.params?.reason || request.params?.command || 'Codexが追加権限を要求しています。'}</p>
                {request.params?.command && <pre>{String(request.params.command)}</pre>}
                {request.params?.cwd && <small>CWD: {String(request.params.cwd)}</small>}
                <details>
                  <summary>request detail</summary>
                  <pre>{stringify(request.params)}</pre>
                </details>
                <div className="approval-actions">
                  <button className="approve" onClick={() => answerApproval(request, 'accept')}>Approve once</button>
                  <button onClick={() => answerApproval(request, 'decline')}>Decline</button>
                  <button onClick={() => answerApproval(request, 'cancel')}>Cancel</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="panel log-panel">
        <div className="panel-head">
          <div>
            <p className="eyebrow">EVENT STREAM</p>
            <h2>Live log</h2>
          </div>
          <button className="text-button" onClick={() => setLogs([])}>clear</button>
        </div>
        <div className="log-list">
          {logs.length === 0 ? <div className="empty-state compact">接続するとRPCとイベントがここに流れます。</div> : logs.map((entry, index) => (
            <div className="log-row" key={`${entry.at}:${entry.method}:${index}`}>
              <time>{entry.at}</time>
              <strong>{entry.method}</strong>
              <span>{entry.summary}</span>
            </div>
          ))}
        </div>
        <button className="raw-toggle" onClick={() => setRawVisible((value) => !value)}>{rawVisible ? 'Hide last raw event' : 'Show last raw event'}</button>
        {rawVisible && <pre className="raw-event">{lastRaw || '—'}</pre>}
      </section>

      <style>{`
        .codex-grid{display:grid;grid-template-columns:minmax(280px,.82fr) minmax(0,1.45fr);gap:16px;align-items:start}
        .panel{border:1px solid #ded9d1;background:rgba(255,255,255,.82);padding:20px;box-shadow:0 12px 32px rgba(45,38,30,.035)}
        .panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:16px}
        .panel-head h2{margin-top:2px;font-size:1.05rem}.eyebrow{color:#8b5b2c;font-size:.64rem;letter-spacing:.12em;font-weight:800}
        .state,.turn-status,.count{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:0 9px;border:1px solid #d8d1c8;background:#f8f6f2;color:#69727b;font-size:.64rem;font-weight:800;letter-spacing:.08em}
        .state-ready{border-color:#b8d9c9;background:#eff8f3;color:#176e49}.state-error{border-color:#e0b8b0;background:#fff2ef;color:#a24234}.state-connecting{border-color:#d8c79f;background:#fff9e9;color:#886319}
        .field{display:grid;gap:6px}.field span{color:#737b84;font-size:.69rem}.field input,textarea{width:100%;border:1px solid #d5d0c8;background:#fff;color:#20242a;padding:11px 12px;font:inherit;font-size:.8rem;outline:none}.field input:focus,textarea:focus{border-color:#b58a53;box-shadow:0 0 0 3px rgba(165,108,34,.09)}
        textarea{resize:vertical;line-height:1.7;min-height:150px}.actions,.approval-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}button{min-height:40px;padding:0 13px;border:1px solid #cfc8bd;background:#fff;color:#4d5660;cursor:pointer;font:inherit;font-size:.72rem}button:hover:not(:disabled){border-color:#b58a53;color:#17191c}button:disabled{opacity:.42;cursor:not-allowed}.primary{border-color:#8b5b2c;background:#8b5b2c;color:#fff}.primary:hover:not(:disabled){background:#754a16;color:#fff}.approve{border-color:#17744d;background:#17744d;color:#fff}.approve:hover:not(:disabled){background:#105f3e;color:#fff}
        .ids{display:grid;gap:7px;margin-top:15px}.ids>div{display:grid;grid-template-columns:54px minmax(0,1fr);gap:8px;align-items:center}.ids span{color:#969ca3;font-size:.58rem;letter-spacing:.1em;font-weight:800}.ids code{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#606872;font-size:.66rem}.error-box{margin-top:12px;padding:10px 11px;border:1px solid #e1bcb4;background:#fff4f1;color:#9a4033;font-size:.72rem;line-height:1.55}
        .setup{margin-top:16px;border-top:1px solid #e3dfd9;padding-top:11px}.setup summary{cursor:pointer;color:#755a38;font-size:.7rem;font-weight:700}.setup>div{display:grid;gap:7px;margin-top:10px}.setup p{color:#707985;font-size:.69rem;line-height:1.55}.setup code{display:block;padding:9px 10px;background:#24282d;color:#f4f2ed;font-size:.69rem;overflow:auto}.setup p code{display:inline;padding:1px 4px}.setup .note{color:#8d5f2c}
        .assistant-output{margin-top:16px;min-height:170px;border:1px solid #ddd8d1;background:#fbfaf8}.output-label{padding:8px 11px;border-bottom:1px solid #e4e0da;color:#8b5b2c;font-size:.61rem;letter-spacing:.12em;font-weight:800}.output-body{padding:14px;white-space:pre-wrap;color:#30363c;font-size:.78rem;line-height:1.75}
        .gate-panel,.log-panel{grid-column:1 / -1}.count{min-width:32px;border-radius:999px}.empty-state{padding:18px;border:1px dashed #d8d2ca;color:#7c858e;background:#fbfaf8;font-size:.74rem;line-height:1.6}.empty-state.compact{padding:12px}
        .approval-list{display:grid;gap:10px}.approval-card{padding:14px;border:1px solid #dfd8ce;background:#fff}.approval-title{display:flex;justify-content:space-between;gap:12px;align-items:center}.approval-title strong{font-size:.8rem}.approval-title code{color:#8b929a;font-size:.65rem}.approval-card>p{margin-top:8px;color:#626b75;font-size:.74rem;line-height:1.6}.approval-card>pre,.approval-card details pre{margin-top:9px;max-height:230px;overflow:auto;padding:10px;background:#252a30;color:#f5f2ed;font-size:.68rem;line-height:1.55;white-space:pre-wrap}.approval-card>small{display:block;margin-top:7px;color:#858d96;font-size:.65rem}.approval-card details{margin-top:9px}.approval-card details summary{cursor:pointer;color:#7b633f;font-size:.66rem}
        .log-list{display:grid;max-height:340px;overflow:auto;border:1px solid #e0dcd6}.log-row{display:grid;grid-template-columns:74px minmax(180px,.45fr) minmax(0,1fr);gap:10px;padding:8px 10px;border-bottom:1px solid #ebe8e3;font-size:.65rem}.log-row:last-child{border-bottom:0}.log-row time{color:#999fa5}.log-row strong{color:#5e4930}.log-row span{min-width:0;color:#717a84;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.text-button,.raw-toggle{min-height:30px;padding:0 8px;border:0;background:transparent;color:#8b5b2c}.raw-toggle{margin-top:8px;padding:0}.raw-event{max-height:300px;overflow:auto;padding:10px;background:#252a30;color:#f5f2ed;font-size:.66rem;line-height:1.5;white-space:pre-wrap}
        @media(max-width:820px){.codex-grid{grid-template-columns:1fr}.gate-panel,.log-panel{grid-column:auto}.log-row{grid-template-columns:60px 1fr}.log-row span{grid-column:1 / -1;white-space:normal}.panel{padding:16px}}
      `}</style>
    </div>
  );
}
