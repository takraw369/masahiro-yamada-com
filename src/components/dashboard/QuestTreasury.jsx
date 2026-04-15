import { useState, useEffect, useCallback, useMemo } from "react";

/*──────────────────────────────────────────────
  QUEST TREASURY v3 — Daily Ledger Edition
  日次収支 × 固定費HP × 積立 × クエスト
──────────────────────────────────────────────*/

const FIXED_ITEMS = [
  { name: "家賃", amount: 77000, cat: "住居" },
  { name: "リース(車)", amount: 35000, cat: "車" },
  { name: "ガソリン", amount: 15000, cat: "車" },
  { name: "楽天SIM ×3", amount: 10000, cat: "通信" },
  { name: "電気", amount: 10000, cat: "光熱" },
  { name: "駐車場", amount: 7000, cat: "車" },
  { name: "ガス", amount: 6226, cat: "光熱" },
  { name: "水道", amount: 5415, cat: "光熱" },
  { name: "Claude", amount: 16000, cat: "AI" },
  { name: "Grok", amount: 5000, cat: "AI" },
  { name: "Wi-Fi", amount: 3800, cat: "通信" },
  { name: "ABEMA", amount: 3800, cat: "生活" },
  { name: "Google", amount: 2900, cat: "ツール" },
  { name: "iCloud", amount: 1500, cat: "ツール" },
  { name: "Canva", amount: 1180, cat: "ツール" },
  { name: "Spotify", amount: 1080, cat: "生活" },
  { name: "Netflix", amount: 890, cat: "生活" },
  { name: "原神", amount: 660, cat: "生活" },
  { name: "Amazon", amount: 600, cat: "生活" },
  { name: "Raindrop", amount: 506, cat: "ツール" },
];
const MONTHLY_FIXED = FIXED_ITEMS.reduce((s, i) => s + i.amount, 0);

const ANNUAL_TARGETS = [
  { name: "Canva", monthly: 1180, annual: 11800, save: 2360 },
  { name: "Raindrop", monthly: 506, annual: 4800, save: 1272 },
  { name: "Spotify", monthly: 1080, annual: 10800, save: 2160 },
];
const ANNUAL_TOTAL = 27400;
const ANNUAL_MONTHLY = Math.ceil(ANNUAL_TOTAL / 12);

const QUESTS = [
  { id: "cloud", name: "クラウド退避 2TB", icon: "☁️", cost: 0, mo: 1300, cat: "shield", desc: "SSD保険。今すぐ。" },
  { id: "fridge", name: "冷蔵庫", icon: "🧊", cost: 120000, mo: 0, cat: "base", desc: "生活基盤" },
  { id: "mac", name: "M4 MacBook Pro", icon: "⚡", cost: 350000, mo: 0, cat: "weapon", desc: "制作環境+SSD解決" },
  { id: "gear", name: "車ギア一式", icon: "🛞", cost: 100000, mo: 0, cat: "vehicle", desc: "移動拠点強化" },
  { id: "eleven", name: "ElevenLabs", icon: "🎙️", cost: 0, mo: 3300, cat: "ai", desc: "月収25万で解放" },
  { id: "kling", name: "Kling AI", icon: "🎬", cost: 0, mo: 1200, cat: "ai", desc: "月収25万で解放" },
  { id: "hiace", name: "ハイエース", icon: "🚐", cost: 5000000, mo: 0, cat: "ultimate", desc: "移動するACEの場" },
];

const CC = { shield: "#38bdf8", base: "#3b82f6", weapon: "#f5c542", vehicle: "#10b981", ai: "#a78bfa", ultimate: "#ef4444" };
const CL = { shield: "防御", base: "基盤", weapon: "武器", vehicle: "移動", ai: "AI投資", ultimate: "究極" };
const EXPENSE_CATS = ["食費", "交通", "日用品", "ツール", "AI", "交際", "医療", "趣味", "その他"];

const fmt = (n) => Math.round(n).toLocaleString("ja-JP");
const today = () => new Date().toISOString().split("T")[0];
const getMonth = (d) => d.slice(0, 7);
const getWeekKey = (d) => {
  const dt = new Date(d);
  const jan1 = new Date(dt.getFullYear(), 0, 1);
  const wk = Math.ceil(((dt - jan1) / 86400000 + jan1.getDay() + 1) / 7);
  return `${dt.getFullYear()}-W${String(wk).padStart(2, "0")}`;
};

const INIT = {
  entries: [],
  fixedPool: 0,
  annualPool: 0,
  investPool: 0,
  questPool: 0,
  unlocked: [],
  monthsCleared: 0,
  currentMonth: getMonth(today()),
};

const SKEY = "quest-treasury-v3";
let mem = null;

function load() {
  try {
    const r = localStorage.getItem(SKEY);
    if (r) return JSON.parse(r);
  } catch {}
  return mem || INIT;
}
function save(d) {
  mem = d;
  try { localStorage.setItem(SKEY, JSON.stringify(d)); } catch {}
}

export default function App() {
  const [d, setD] = useState(() => load());
  const [tab, setTab] = useState("home");
  const [modal, setModal] = useState(null); // "income" | "expense" | null
  const [amt, setAmt] = useState("");
  const [memo, setMemo] = useState("");
  const [expCat, setExpCat] = useState("食費");
  const [entryDate, setEntryDate] = useState(today());
  const [simW, setSimW] = useState("75000");
  const [showFix, setShowFix] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewPeriod, setViewPeriod] = useState("day"); // day/week/month

  useEffect(() => { save(d); }, [d]);

  // Check month rollover
  useEffect(() => {
    const cm = getMonth(today());
    if (d.currentMonth !== cm) {
      setD(p => {
        const cleared = p.fixedPool >= MONTHLY_FIXED;
        return {
          ...p,
          fixedPool: 0,
          monthsCleared: p.monthsCleared + (cleared ? 1 : 0),
          currentMonth: cm,
        };
      });
    }
  }, []);

  // Derived
  const thisMonth = getMonth(today());
  const thisWeek = getWeekKey(today());
  const todayStr = today();

  const incomeEntries = d.entries.filter(e => e.type === "income");
  const expenseEntries = d.entries.filter(e => e.type === "expense");

  const periodEntries = useMemo(() => {
    return d.entries.filter(e => {
      if (viewPeriod === "day") return e.date === todayStr;
      if (viewPeriod === "week") return getWeekKey(e.date) === thisWeek;
      return getMonth(e.date) === thisMonth;
    });
  }, [d.entries, viewPeriod, todayStr, thisWeek, thisMonth]);

  const periodIncome = periodEntries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
  const periodExpense = periodEntries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
  const periodNet = periodIncome - periodExpense;

  const totalIncome = incomeEntries.reduce((s, e) => s + e.amount, 0);
  const totalExpense = expenseEntries.reduce((s, e) => s + e.amount, 0);

  const monthIncome = incomeEntries.filter(e => getMonth(e.date) === thisMonth).reduce((s, e) => s + e.amount, 0);
  const monthExpense = expenseEntries.filter(e => getMonth(e.date) === thisMonth).reduce((s, e) => s + e.amount, 0);

  const weeks = new Set(incomeEntries.map(e => getWeekKey(e.date))).size || 1;
  const avgWeekly = Math.round(totalIncome / weeks);
  const monthPace = Math.round(avgWeekly * 4.33);
  const fixPct = Math.min(100, Math.round((d.fixedPool / MONTHLY_FIXED) * 100));
  const annPct = Math.min(100, Math.round((d.annualPool / ANNUAL_TOTAL) * 100));

  // Add entry
  const addEntry = useCallback((type) => {
    const raw = parseInt(amt.replace(/[,，\s]/g, ""), 10);
    if (!raw || raw <= 0) return;

    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      type,
      amount: raw,
      memo: type === "income" ? memo : `${expCat}${memo ? ": " + memo : ""}`,
      cat: type === "expense" ? expCat : "収入",
      date: entryDate,
    };

    setD(prev => {
      let p = { ...prev, entries: [...prev.entries, entry] };

      if (type === "income") {
        let r = raw;
        // ① Fixed HP
        const fNeed = Math.max(0, MONTHLY_FIXED - p.fixedPool);
        const aF = Math.min(r, fNeed); r -= aF;
        // ② Annual
        const aNeed = Math.max(0, ANNUAL_TOTAL - p.annualPool);
        const aA = Math.min(Math.min(r, ANNUAL_MONTHLY), aNeed); r -= aA;
        // ③ Invest 10%
        const aI = Math.round(r * 0.1); r -= aI;
        // ④ Quest
        const aQ = r;

        p.fixedPool += aF;
        p.annualPool += aA;
        p.investPool += aI;
        p.questPool += aQ;

        // Check clear
        if (p.fixedPool >= MONTHLY_FIXED && prev.fixedPool < MONTHLY_FIXED) {
          // Don't reset immediately—reset on month change
        }
      }
      // Expenses are tracked but don't reduce pools (pools = income allocation)
      return p;
    });

    setAmt("");
    setMemo("");
    setModal(null);
  }, [amt, memo, expCat, entryDate]);

  const deleteEntry = useCallback((id) => {
    setD(p => ({ ...p, entries: p.entries.filter(e => e.id !== id) }));
    setEditId(null);
  }, []);

  const unlockQuest = useCallback((id) => {
    const q = QUESTS.find(i => i.id === id);
    if (!q || d.unlocked.includes(id)) return;
    if (q.cost > 0 && d.questPool < q.cost) return;
    setD(p => ({ ...p, questPool: p.questPool - (q.cost || 0), unlocked: [...p.unlocked, id] }));
  }, [d]);

  const switchAnnual = useCallback(() => {
    if (d.annualPool < ANNUAL_TOTAL) return;
    setD(p => ({ ...p, annualPool: p.annualPool - ANNUAL_TOTAL }));
  }, [d]);

  const resetAll = useCallback(() => { if (confirm("全データリセット？")) setD(INIT); }, []);

  // Sim
  const sW = parseInt(simW.replace(/[,，\s]/g, ""), 10) || 0;
  const sM = Math.round(sW * 4.33);
  const sAfter = Math.max(0, sM - MONTHLY_FIXED);
  const sAnn = Math.min(sAfter, ANNUAL_MONTHLY);
  const sRem = sAfter - sAnn;
  const sInv = Math.round(sRem * 0.1);
  const sQ = sRem - sInv;
  const simTo = (cost) => {
    if (sQ <= 0) return "—";
    const wq = sQ / 4.33;
    const need = Math.max(0, cost - d.questPool);
    return need <= 0 ? "今すぐ" : Math.ceil(need / wq) + "週";
  };
  const annMo = () => {
    if (sAnn <= 0) return "—";
    const need = Math.max(0, ANNUAL_TOTAL - d.annualPool);
    return need <= 0 ? "今すぐ" : Math.ceil(need / sAnn) + "ヶ月";
  };

  // Styles
  const Box = ({ children, style: s = {}, ...p }) => (
    <div style={{ background: "#0e0e16", border: "1px solid #1e1e2a", borderRadius: 8, padding: 12, marginBottom: 8, ...s }} {...p}>{children}</div>
  );
  const Btn = ({ children, style: s = {}, ...p }) => (
    <button style={{ background: "#f5c542", color: "#08080d", border: "none", borderRadius: 5, padding: "8px 14px", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit", ...s }} {...p}>{children}</button>
  );
  const tabS = (k) => ({
    background: "none", border: "none",
    borderBottom: tab === k ? "2px solid #f5c542" : "2px solid transparent",
    color: tab === k ? "#f5c542" : "#555",
    padding: "8px 8px", fontSize: 10, letterSpacing: 1,
    cursor: "pointer", fontFamily: "inherit", whiteSpace: "nowrap",
  });
  const periodS = (k) => ({
    background: viewPeriod === k ? "#f5c54220" : "transparent",
    border: viewPeriod === k ? "1px solid #f5c54240" : "1px solid #1e1e2a",
    color: viewPeriod === k ? "#f5c542" : "#555",
    borderRadius: 4, padding: "4px 10px", fontSize: 9,
    cursor: "pointer", fontFamily: "inherit",
  });

  return (
    <div style={{ fontFamily: "'SF Mono','Courier New',monospace", background: "#08080d", color: "#d8d5cd", minHeight: "100vh", padding: 16, maxWidth: 540, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 14, paddingBottom: 10, borderBottom: "1px solid #1a1a24" }}>
        <div style={{ fontSize: 9, letterSpacing: 6, color: "#444" }}>SUN LOVES FLOW</div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: "#f5c542", margin: "4px 0", letterSpacing: 2 }}>QUEST TREASURY</h1>
        <div style={{ fontSize: 9, color: "#333" }}>{today()}</div>
      </div>

      {/* HP Bar */}
      <Box>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: "#ef4444", letterSpacing: 2, fontWeight: 600 }}>❤️ 固定費HP</span>
          <span style={{ fontSize: 12, color: fixPct >= 100 ? "#10b981" : "#ef4444" }}>¥{fmt(d.fixedPool)} / ¥{fmt(MONTHLY_FIXED)}</span>
        </div>
        <div style={{ background: "#1a1a24", borderRadius: 4, height: 10, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${fixPct}%`, background: fixPct >= 100 ? "linear-gradient(90deg,#10b981,#34d399)" : fixPct >= 50 ? "linear-gradient(90deg,#f59e0b,#f5c542)" : "linear-gradient(90deg,#ef4444,#f87171)", borderRadius: 4, transition: "width 0.4s" }} />
        </div>
        <div style={{ fontSize: 9, color: "#444", marginTop: 3 }}>
          {fixPct >= 100 ? "✅ 今月クリア！" : `あと ¥${fmt(MONTHLY_FIXED - d.fixedPool)}`}
          {d.monthsCleared > 0 && <span style={{ marginLeft: 8, color: "#10b981" }}>🏅×{d.monthsCleared}</span>}
        </div>
        <button onClick={() => setShowFix(!showFix)} style={{ marginTop: 4, background: "none", border: "none", color: "#444", fontSize: 9, cursor: "pointer", fontFamily: "inherit", padding: 0 }}>
          {showFix ? "▾ 閉じる" : "▸ 内訳"}
        </button>
        {showFix && (
          <div style={{ marginTop: 4, fontSize: 10, color: "#555", lineHeight: 1.8, maxHeight: 200, overflowY: "auto" }}>
            {FIXED_ITEMS.map(f => (
              <div key={f.name} style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{f.name} <span style={{ color: "#333", fontSize: 8 }}>{f.cat}</span></span>
                <span style={{ color: "#666" }}>¥{fmt(f.amount)}</span>
              </div>
            ))}
          </div>
        )}
      </Box>

      {/* 3 Pools */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
        {[
          { l: "年課金積立", v: d.annualPool, t: ANNUAL_TOTAL, c: "#38bdf8" },
          { l: "投資積立", v: d.investPool, c: "#a78bfa" },
          { l: "クエスト原資", v: d.questPool, c: "#f5c542" },
        ].map(p => (
          <div key={p.l} style={{ background: "#0e0e16", border: "1px solid #1e1e2a", borderRadius: 6, padding: "8px 6px", textAlign: "center" }}>
            <div style={{ fontSize: 7, color: "#555", letterSpacing: 1 }}>{p.l}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: p.c }}>¥{fmt(p.v)}</div>
            {p.t && <div style={{ fontSize: 7, color: "#333" }}>/ ¥{fmt(p.t)}</div>}
          </div>
        ))}
      </div>

      {/* + / - Buttons */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        <button onClick={() => { setModal("income"); setEntryDate(today()); }} style={{ flex: 1, padding: 12, background: "linear-gradient(135deg,#10b981,#059669)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          💰 収入
        </button>
        <button onClick={() => { setModal("expense"); setEntryDate(today()); }} style={{ flex: 1, padding: 12, background: "linear-gradient(135deg,#ef4444,#dc2626)", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>
          💸 支出
        </button>
      </div>

      {/* Modal */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "#000000cc", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#12121a", borderRadius: 12, padding: 20, width: "100%", maxWidth: 400, border: "1px solid #2a2a35" }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: modal === "income" ? "#10b981" : "#ef4444", marginBottom: 14 }}>
              {modal === "income" ? "💰 収入を記録" : "💸 支出を記録"}
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: "#666", marginBottom: 4 }}>日付</div>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}
                style={{ width: "100%", background: "#08080d", border: "1px solid #252530", borderRadius: 4, padding: "8px 10px", color: "#ccc", fontSize: 13, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>

            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: "#666", marginBottom: 4 }}>金額</div>
              <input type="text" inputMode="numeric" value={amt} onChange={e => setAmt(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addEntry(modal)}
                placeholder="10,000" autoFocus
                style={{ width: "100%", background: "#08080d", border: "1px solid #252530", borderRadius: 4, padding: "10px", color: modal === "income" ? "#10b981" : "#ef4444", fontSize: 20, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>

            {modal === "expense" && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: "#666", marginBottom: 4 }}>カテゴリ</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {EXPENSE_CATS.map(c => (
                    <button key={c} onClick={() => setExpCat(c)}
                      style={{ padding: "4px 10px", borderRadius: 4, fontSize: 10, cursor: "pointer", fontFamily: "inherit", border: expCat === c ? "1px solid #ef4444" : "1px solid #252530", background: expCat === c ? "#ef444420" : "#08080d", color: expCat === c ? "#ef4444" : "#666" }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: "#666", marginBottom: 4 }}>メモ</div>
              <input type="text" value={memo} onChange={e => setMemo(e.target.value)}
                onKeyDown={e => e.key === "Enter" && addEntry(modal)}
                placeholder={modal === "income" ? "案件名など" : "詳細"}
                style={{ width: "100%", background: "#08080d", border: "1px solid #252530", borderRadius: 4, padding: "8px 10px", color: "#ccc", fontSize: 12, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setModal(null); setAmt(""); setMemo(""); }}
                style={{ flex: 1, padding: 10, background: "none", border: "1px solid #252530", borderRadius: 6, color: "#666", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>キャンセル</button>
              <button onClick={() => addEntry(modal)}
                style={{ flex: 1, padding: 10, background: modal === "income" ? "#10b981" : "#ef4444", color: "#fff", border: "none", borderRadius: 6, fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>記録</button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, marginBottom: 12, borderBottom: "1px solid #1a1a24", overflowX: "auto" }}>
        {[
          { k: "home", l: "HOME" },
          { k: "log", l: "収支LOG" },
          { k: "quest", l: "QUEST" },
          { k: "sim", l: "SIM" },
          { k: "annual", l: "年課金" },
        ].map(t => <button key={t.k} onClick={() => setTab(t.k)} style={tabS(t.k)}>{t.l}</button>)}
      </div>

      {/* HOME */}
      {tab === "home" && (
        <div>
          {/* Period toggle */}
          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {[["day", "今日"], ["week", "今週"], ["month", "今月"]].map(([k, l]) => (
              <button key={k} onClick={() => setViewPeriod(k)} style={periodS(k)}>{l}</button>
            ))}
          </div>

          <Box>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 8, color: "#555" }}>収入</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#10b981" }}>¥{fmt(periodIncome)}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 8, color: "#555" }}>支出</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#ef4444" }}>¥{fmt(periodExpense)}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 8, color: "#555" }}>収支</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: periodNet >= 0 ? "#f5c542" : "#ef4444" }}>
                  {periodNet >= 0 ? "+" : ""}¥{fmt(periodNet)}
                </div>
              </div>
            </div>
          </Box>

          {/* Flow explanation */}
          <div style={{ fontSize: 10, color: "#666", marginBottom: 8, marginTop: 4 }}>稼ぎの配分フロー</div>
          {[
            { s: "①", l: "固定費HP", c: "#ef4444", desc: `月¥${fmt(MONTHLY_FIXED)}`, ok: fixPct >= 100 },
            { s: "②", l: "年課金積立", c: "#38bdf8", desc: `月¥${fmt(ANNUAL_MONTHLY)}`, ok: d.annualPool >= ANNUAL_TOTAL },
            { s: "③", l: "投資 10%", c: "#a78bfa", desc: "AI・Mac原資" },
            { s: "④", l: "クエスト原資", c: "#f5c542", desc: "欲しいモノ解放" },
          ].map((f, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4, padding: "6px 8px", background: "#0e0e16", borderRadius: 5, border: `1px solid ${f.ok ? f.c + "30" : "#1a1a24"}` }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: f.c, minWidth: 16 }}>{f.s}</span>
              <span style={{ fontSize: 11, color: f.ok ? "#10b981" : "#bbb", flex: 1 }}>{f.l} {f.ok && "✅"}</span>
              <span style={{ fontSize: 9, color: "#444" }}>{f.desc}</span>
            </div>
          ))}

          {/* Quick stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 10 }}>
            {[
              { l: "累計収入", v: `¥${fmt(totalIncome)}` },
              { l: "累計支出", v: `¥${fmt(totalExpense)}` },
              { l: "週平均収入", v: `¥${fmt(avgWeekly)}` },
              { l: "月ペース", v: `¥${fmt(monthPace)}`, h: monthPace >= 300000 },
            ].map(s => (
              <div key={s.l} style={{ background: "#0e0e16", borderRadius: 5, padding: "6px 8px" }}>
                <div style={{ fontSize: 7, color: "#444", letterSpacing: 1 }}>{s.l}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: s.h ? "#10b981" : "#bbb" }}>{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LOG */}
      {tab === "log" && (
        <div>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {[["day", "今日"], ["week", "今週"], ["month", "今月"]].map(([k, l]) => (
              <button key={k} onClick={() => setViewPeriod(k)} style={periodS(k)}>{l}</button>
            ))}
          </div>
          {periodEntries.length === 0
            ? <div style={{ textAlign: "center", padding: 28, color: "#333", fontSize: 11 }}>この期間のデータなし</div>
            : [...periodEntries].reverse().map(e => (
              <div key={e.id} onClick={() => setEditId(editId === e.id ? null : e.id)}
                style={{ padding: "8px 10px", background: "#0e0e16", borderRadius: 5, marginBottom: 4, cursor: "pointer", border: editId === e.id ? "1px solid #333" : "1px solid transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "#777" }}>
                    <span style={{ color: e.type === "income" ? "#10b98180" : "#ef444480", marginRight: 6 }}>
                      {e.type === "income" ? "💰" : "💸"}
                    </span>
                    {e.memo || e.cat}
                  </span>
                  <span style={{ color: e.type === "income" ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                    {e.type === "income" ? "+" : "−"}¥{fmt(e.amount)}
                  </span>
                </div>
                <div style={{ fontSize: 8, color: "#2a2a35", marginTop: 2 }}>{e.date}</div>
                {editId === e.id && (
                  <button onClick={(ev) => { ev.stopPropagation(); deleteEntry(e.id); }}
                    style={{ marginTop: 6, padding: "4px 12px", background: "none", border: "1px solid #442222", borderRadius: 3, color: "#663333", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>
                    削除
                  </button>
                )}
              </div>
            ))}
        </div>
      )}

      {/* QUEST */}
      {tab === "quest" && (
        <div>
          {QUESTS.filter(q => !d.unlocked.includes(q.id)).map(q => {
            const canBuy = q.cost > 0 && d.questPool >= q.cost;
            const isAI = q.cat === "ai";
            const pct = q.cost > 0 ? Math.min(100, Math.round((d.questPool / q.cost) * 100)) : 0;
            return (
              <Box key={q.id} style={{ border: `1px solid ${canBuy ? CC[q.cat] + "60" : "#1e1e2a"}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{q.icon}</span>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 600 }}>{q.name}</div>
                      <div style={{ fontSize: 9, color: "#555" }}>{q.desc}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {q.cost > 0
                      ? <div style={{ fontSize: 12, color: CC[q.cat], fontWeight: 600 }}>¥{fmt(q.cost)}</div>
                      : <div style={{ fontSize: 10, color: CC[q.cat] }}>¥{fmt(q.mo)}/月</div>}
                    <div style={{ fontSize: 7, padding: "1px 4px", background: CC[q.cat] + "15", color: CC[q.cat], borderRadius: 3, display: "inline-block" }}>{CL[q.cat]}</div>
                  </div>
                </div>
                {q.cost > 0 && (
                  <>
                    <div style={{ marginTop: 6, background: "#141420", borderRadius: 3, height: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: CC[q.cat], borderRadius: 3, transition: "width 0.4s" }} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#444", marginTop: 2 }}>
                      <span>{pct}%</span>
                      <span>{canBuy ? "🔓 解放可能" : `残 ¥${fmt(Math.max(0, q.cost - d.questPool))}`}</span>
                    </div>
                  </>
                )}
                {isAI && <div style={{ fontSize: 9, color: "#555", marginTop: 4 }}>{monthPace >= 250000 ? "🔓 月25万クリア！" : `ペース ¥${fmt(monthPace)} / ¥250,000`}</div>}
                {q.id === "cloud" && <div style={{ fontSize: 9, color: "#38bdf8", marginTop: 4 }}>⚡ 月¥1,300でSSD死亡保険</div>}
                {canBuy && (
                  <button onClick={() => unlockQuest(q.id)} style={{ marginTop: 6, width: "100%", padding: 8, background: CC[q.cat], color: "#08080d", border: "none", borderRadius: 5, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                    ⚔️ 解放（¥{fmt(q.cost)}）
                  </button>
                )}
              </Box>
            );
          })}
          {d.unlocked.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 8, borderTop: "1px solid #1a1a24" }}>
              <div style={{ fontSize: 8, color: "#444", letterSpacing: 2, marginBottom: 4 }}>UNLOCKED</div>
              {QUESTS.filter(q => d.unlocked.includes(q.id)).map(q => (
                <div key={q.id} style={{ display: "flex", gap: 6, padding: "3px 0", color: "#333", fontSize: 10 }}>
                  <span>{q.icon}</span><span style={{ textDecoration: "line-through" }}>{q.name}</span><span style={{ color: "#10b981" }}>✓</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SIM */}
      {tab === "sim" && (
        <div>
          <div style={{ fontSize: 10, color: "#666", marginBottom: 8 }}>週いくらで何がいつ手に入る？</div>
          <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 12, background: "#0e0e16", border: "1px solid #1e1e2a", borderRadius: 8, padding: 10 }}>
            <span style={{ fontSize: 9, color: "#666" }}>週収 ¥</span>
            <input type="text" inputMode="numeric" value={simW} onChange={e => setSimW(e.target.value)}
              style={{ flex: 1, background: "#08080d", border: "1px solid #252530", borderRadius: 4, padding: "7px 10px", color: "#f5c542", fontSize: 15, fontFamily: "inherit", outline: "none" }} />
          </div>
          <Box>
            <div style={{ fontSize: 9, color: "#555", marginBottom: 6 }}>月次フロー</div>
            {[
              { l: "月収", v: sM, c: "#ccc" },
              { l: "① 固定費", v: MONTHLY_FIXED, c: "#ef4444" },
              { l: "② 年課金積立", v: sAnn, c: "#38bdf8" },
              { l: "③ 投資", v: sInv, c: "#a78bfa" },
              { l: "④ クエスト", v: sQ, c: "#f5c542" },
            ].map(r => (
              <div key={r.l} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid #141420", fontSize: 11 }}>
                <span style={{ color: "#666" }}>{r.l}</span>
                <span style={{ color: r.c, fontWeight: 600 }}>¥{fmt(r.v)}</span>
              </div>
            ))}
          </Box>
          <div style={{ fontSize: 9, color: "#555", marginBottom: 6, marginTop: 4 }}>到達予測</div>
          {QUESTS.filter(q => q.cost > 0 && q.id !== "cloud").map(q => (
            <div key={q.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", background: "#0e0e16", borderRadius: 5, marginBottom: 3, fontSize: 11 }}>
              <span>{q.icon} {q.name}</span>
              <span style={{ color: CC[q.cat], fontWeight: 600 }}>{simTo(q.cost)}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", background: "#0e0e16", borderRadius: 5, marginTop: 3, fontSize: 11 }}>
            <span>🔄 年課金切替</span><span style={{ color: "#38bdf8", fontWeight: 600 }}>{annMo()}</span>
          </div>
        </div>
      )}

      {/* ANNUAL */}
      {tab === "annual" && (
        <div>
          <Box style={{ padding: 14 }}>
            <div style={{ fontSize: 10, color: "#38bdf8", letterSpacing: 2, marginBottom: 5, fontWeight: 600 }}>年課金積立</div>
            <div style={{ background: "#141420", borderRadius: 4, height: 8, overflow: "hidden", marginBottom: 4 }}>
              <div style={{ height: "100%", width: `${annPct}%`, background: "linear-gradient(90deg,#38bdf8,#06b6d4)", borderRadius: 4 }} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555" }}>
              <span>¥{fmt(d.annualPool)} / ¥{fmt(ANNUAL_TOTAL)}</span><span>{annPct}%</span>
            </div>
            {d.annualPool >= ANNUAL_TOTAL && (
              <button onClick={switchAnnual} style={{ marginTop: 8, width: "100%", padding: 9, background: "linear-gradient(135deg,#38bdf8,#06b6d4)", color: "#08080d", border: "none", borderRadius: 5, fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}>
                🔄 一括切替（¥{fmt(ANNUAL_TOTAL)}）
              </button>
            )}
          </Box>
          <div style={{ fontSize: 10, color: "#666", marginBottom: 6 }}>年間 ¥{fmt(5792)} 節約</div>
          {ANNUAL_TARGETS.map(s => (
            <Box key={s.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 10 }}>
              <div>
                <div style={{ fontSize: 12 }}>{s.name}</div>
                <div style={{ fontSize: 9, color: "#444" }}>月¥{fmt(s.monthly)} → 年¥{fmt(s.annual)}</div>
              </div>
              <div style={{ fontSize: 10, color: "#10b981", background: "#10b98115", padding: "3px 8px", borderRadius: 4, fontWeight: 600 }}>−¥{fmt(s.save)}/年</div>
            </Box>
          ))}
          <div style={{ marginTop: 8, fontSize: 9, color: "#444", lineHeight: 1.5 }}>
            💡 月¥{fmt(ANNUAL_MONTHLY)}自動積立 → 貯まったら切替。Grok/Netflix/ABEMA/Amazonは月のまま。
          </div>
        </div>
      )}

      {/* Reset */}
      {tab === "log" && (
        <button onClick={resetAll} style={{ marginTop: 16, width: "100%", padding: 7, background: "none", border: "1px solid #1e1010", borderRadius: 4, color: "#442222", fontSize: 9, cursor: "pointer", fontFamily: "inherit" }}>RESET ALL</button>
      )}

      <div style={{ marginTop: 20, textAlign: "center", fontSize: 8, color: "#1a1a24", letterSpacing: 2 }}>
        ── 死ぬ直前の"イキ"を、ヒトをいかす為に使え ──
      </div>
    </div>
  );
}
