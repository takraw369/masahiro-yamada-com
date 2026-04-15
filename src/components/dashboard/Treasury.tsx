import { useState, useEffect } from 'react';

interface Transaction {
  id: string;
  date: string;
  type: 'income' | 'expense';
  category: string;
  amount: number;
  memo: string;
}

const INCOME_CATEGORIES = ['ACEコーチング', 'コンテンツ販売', 'Coconala', 'その他'];
const EXPENSE_CATEGORIES = ['ツール・サブスク', '交通費', '食事', 'その他'];

const gold = '#C9A96E';
const goldMuted = '#8B7355';
const bgSurface = '#1A1612';
const bgElevated = '#241F1A';
const textPrimary = '#D4C5A9';
const textMuted = '#7A6F5F';
const borderDefault = '#2E2822';

function genId() { return Math.random().toString(36).slice(2,9); }

function loadTransactions(): Transaction[] {
  try {
    const s = localStorage.getItem('ace-treasury-v1');
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}

function saveTransactions(txs: Transaction[]) {
  try {
    localStorage.setItem('ace-treasury-v1', JSON.stringify(txs));
  } catch {}
}

function getMonthKey(date: string): string {
  return date.slice(0, 7); // "YYYY-MM"
}

function formatJPY(n: number): string {
  return n.toLocaleString('ja-JP') + '円';
}

export default function Treasury() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: 'income' as 'income' | 'expense',
    category: INCOME_CATEGORIES[0],
    amount: '',
    memo: '',
  });
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    setTransactions(loadTransactions());
  }, []);

  const handleTypeChange = (type: 'income' | 'expense') => {
    setForm(f => ({
      ...f,
      type,
      category: type === 'income' ? INCOME_CATEGORIES[0] : EXPENSE_CATEGORIES[0],
    }));
  };

  const addTransaction = () => {
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return;
    const tx: Transaction = {
      id: genId(),
      date: form.date,
      type: form.type,
      category: form.category,
      amount,
      memo: form.memo,
    };
    const next = [tx, ...transactions];
    setTransactions(next);
    saveTransactions(next);
    setForm(f => ({ ...f, amount: '', memo: '' }));
  };

  const deleteTransaction = (id: string) => {
    const next = transactions.filter(t => t.id !== id);
    setTransactions(next);
    saveTransactions(next);
  };

  // Filter by month
  const monthTxs = transactions.filter(t => t.date.startsWith(selectedMonth));
  const totalIncome = monthTxs.filter(t => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  const totalExpense = monthTxs.filter(t => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const balance = totalIncome - totalExpense;

  // Get available months
  const months = Array.from(new Set(transactions.map(t => getMonthKey(t.date)))).sort().reverse();
  if (!months.includes(selectedMonth)) months.unshift(selectedMonth);

  // Monthly bar chart data (last 6 months)
  const now = new Date();
  const barMonths = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return d.toISOString().slice(0, 7);
  });
  const barData = barMonths.map(m => {
    const inc = transactions.filter(t => t.date.startsWith(m) && t.type === 'income').reduce((a, t) => a + t.amount, 0);
    const exp = transactions.filter(t => t.date.startsWith(m) && t.type === 'expense').reduce((a, t) => a + t.amount, 0);
    return { month: m, income: inc, expense: exp };
  });
  const maxBar = Math.max(...barData.flatMap(d => [d.income, d.expense]), 1);

  const S = {
    section: { marginBottom: 32 } as React.CSSProperties,
    sectionTitle: {
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: '1.1rem',
      fontWeight: 300,
      color: gold,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      marginBottom: 16,
      paddingBottom: 8,
      borderBottom: `1px solid ${borderDefault}`,
    },
    card: {
      background: bgSurface,
      border: `1px solid ${borderDefault}`,
      padding: '20px',
    },
    summaryGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 1fr)',
      gap: 12,
      marginBottom: 24,
    },
    summaryCard: (color: string) => ({
      background: bgSurface,
      border: `1px solid ${borderDefault}`,
      padding: '16px 20px',
      textAlign: 'center' as const,
    }),
    summaryLabel: {
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: '0.7rem',
      color: textMuted,
      letterSpacing: '0.1em',
      textTransform: 'uppercase' as const,
      marginBottom: 8,
    },
    summaryNum: (color: string) => ({
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: '1.5rem',
      fontWeight: 300,
      color,
    }),
    formGrid: {
      display: 'grid',
      gridTemplateColumns: '120px 1fr 1fr 1fr',
      gap: 10,
      alignItems: 'end',
      marginBottom: 10,
    },
    label: {
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: '0.7rem',
      color: textMuted,
      letterSpacing: '0.08em',
      textTransform: 'uppercase' as const,
      marginBottom: 6,
      display: 'block',
    },
    input: {
      background: 'transparent',
      border: 'none',
      borderBottom: `1px solid ${borderDefault}`,
      color: textPrimary,
      fontFamily: "'Zen Kaku Gothic New', sans-serif",
      fontSize: '0.9rem',
      padding: '8px 4px',
      outline: 'none',
      width: '100%',
    },
    select: {
      background: bgElevated,
      border: `1px solid ${borderDefault}`,
      color: textPrimary,
      fontFamily: "'Zen Kaku Gothic New', sans-serif",
      fontSize: '0.85rem',
      padding: '8px 10px',
      outline: 'none',
      width: '100%',
      cursor: 'pointer',
    },
    typeBtn: (active: boolean, color: string) => ({
      padding: '8px 16px',
      border: `1px solid ${active ? color : borderDefault}`,
      background: active ? `${color}15` : 'transparent',
      color: active ? color : textMuted,
      cursor: 'pointer',
      fontFamily: "'Zen Kaku Gothic New', sans-serif",
      fontSize: '0.85rem',
      transition: 'all 0.2s',
    }),
    addBtn: {
      padding: '10px 28px',
      background: `linear-gradient(135deg, ${goldMuted}, #5A4D3A)`,
      border: 'none',
      color: '#0D0B08',
      fontFamily: "'Cormorant Garamond', serif",
      fontSize: '0.85rem',
      fontWeight: 600,
      letterSpacing: '0.1em',
      cursor: 'pointer',
      marginTop: 12,
    },
    txRow: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '10px 0',
      borderBottom: `1px solid ${borderDefault}`,
      fontSize: '0.85rem',
    },
    delBtn: {
      padding: '3px 8px',
      border: '1px solid rgba(232,92,82,0.3)',
      background: 'none',
      color: '#E85D4A',
      cursor: 'pointer',
      fontSize: '0.75rem',
      marginLeft: 'auto',
    },
  };

  const categories = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <div style={{ fontFamily: "'Zen Kaku Gothic New', sans-serif", paddingBottom: 40 }}>
      {/* Monthly summary */}
      <div style={S.section}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={S.sectionTitle}>月次サマリー</div>
          <select
            style={{ ...S.select, width: 'auto', minWidth: 120 }}
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
          >
            {months.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        <div style={S.summaryGrid}>
          <div style={S.summaryCard('#5DAA68')}>
            <div style={S.summaryLabel}>収入</div>
            <div style={S.summaryNum('#5DAA68')}>{formatJPY(totalIncome)}</div>
          </div>
          <div style={S.summaryCard('#E85D4A')}>
            <div style={S.summaryLabel}>支出</div>
            <div style={S.summaryNum('#E85D4A')}>{formatJPY(totalExpense)}</div>
          </div>
          <div style={S.summaryCard(balance >= 0 ? gold : '#E85D4A')}>
            <div style={S.summaryLabel}>差額</div>
            <div style={S.summaryNum(balance >= 0 ? gold : '#E85D4A')}>
              {balance >= 0 ? '+' : ''}{formatJPY(balance)}
            </div>
          </div>
        </div>
      </div>

      {/* Bar chart */}
      <div style={S.section}>
        <div style={S.sectionTitle}>月間推移（6ヶ月）</div>
        <div style={{ background: bgSurface, border: `1px solid ${borderDefault}`, padding: '20px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
            {barData.map(d => (
              <div key={d.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 80, gap: 2 }}>
                  <div style={{ width: '100%', height: `${Math.round((d.income / maxBar) * 70)}px`, background: '#5DAA6855', minHeight: d.income > 0 ? 2 : 0 }} />
                  <div style={{ width: '100%', height: `${Math.round((d.expense / maxBar) * 70)}px`, background: '#E85D4A55', minHeight: d.expense > 0 ? 2 : 0 }} />
                </div>
                <div style={{ fontSize: '0.6rem', color: textMuted, textAlign: 'center', whiteSpace: 'nowrap' as const }}>
                  {d.month.slice(5)}月
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, justifyContent: 'center' }}>
            <span style={{ fontSize: '0.7rem', color: '#5DAA68', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, background: '#5DAA68', display: 'inline-block' }} />収入
            </span>
            <span style={{ fontSize: '0.7rem', color: '#E85D4A', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 8, height: 8, background: '#E85D4A', display: 'inline-block' }} />支出
            </span>
          </div>
        </div>
      </div>

      {/* Add transaction form */}
      <div style={S.section}>
        <div style={S.sectionTitle}>記録を追加</div>
        <div style={{ background: bgSurface, border: `1px solid ${borderDefault}`, padding: '20px' }}>
          {/* Type buttons */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 20 }}>
            <button style={S.typeBtn(form.type === 'income', '#5DAA68')} onClick={() => handleTypeChange('income')}>
              収入
            </button>
            <button style={S.typeBtn(form.type === 'expense', '#E85D4A')} onClick={() => handleTypeChange('expense')}>
              支出
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={S.label}>日付</label>
              <input
                type="date"
                style={S.input}
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div>
              <label style={S.label}>カテゴリ</label>
              <select
                style={S.select}
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={S.label}>金額（円）</label>
              <input
                type="number"
                style={S.input}
                placeholder="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                min={0}
              />
            </div>
            <div>
              <label style={S.label}>メモ</label>
              <input
                type="text"
                style={S.input}
                placeholder="任意"
                value={form.memo}
                onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              />
            </div>
          </div>

          <button style={S.addBtn} onClick={addTransaction}>
            追加
          </button>
        </div>
      </div>

      {/* Transaction list */}
      <div style={S.section}>
        <div style={S.sectionTitle}>{selectedMonth} の明細</div>
        {monthTxs.length === 0 ? (
          <div style={{ color: textMuted, fontSize: '0.875rem', padding: '20px 0' }}>この月の記録はありません</div>
        ) : (
          <div style={{ background: bgSurface, border: `1px solid ${borderDefault}`, padding: '0 16px' }}>
            {monthTxs
              .sort((a, b) => b.date.localeCompare(a.date))
              .map(tx => (
                <div key={tx.id} style={S.txRow}>
                  <span style={{ color: textMuted, fontSize: '0.75rem', flexShrink: 0 }}>{tx.date}</span>
                  <span style={{
                    padding: '2px 8px',
                    background: tx.type === 'income' ? '#5DAA6820' : '#E85D4A20',
                    color: tx.type === 'income' ? '#5DAA68' : '#E85D4A',
                    fontSize: '0.7rem',
                    flexShrink: 0,
                  }}>
                    {tx.category}
                  </span>
                  <span style={{ color: textPrimary, fontSize: '0.85rem', flex: 1 }}>
                    {tx.memo || '—'}
                  </span>
                  <span style={{
                    color: tx.type === 'income' ? '#5DAA68' : '#E85D4A',
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: '1rem',
                    fontWeight: 300,
                    flexShrink: 0,
                  }}>
                    {tx.type === 'income' ? '+' : '-'}{formatJPY(tx.amount)}
                  </span>
                  <button style={S.delBtn} onClick={() => deleteTransaction(tx.id)}>✕</button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
