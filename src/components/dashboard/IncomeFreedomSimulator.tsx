import { useState } from 'react';

const money = (amount: number) => amount.toFixed(1);
const yen = (man: number) => new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 }).format(Math.round(man * 10000));
const TARGETS = [
  { amount: 30, title: '生活を支える', detail: '雇用以外の継続収入を育て、生活の土台を整える。' },
  { amount: 45, title: '小さな旅を試す', detail: 'レンタカーや犬OK宿で、2〜3泊の旅行を試す。' },
  { amount: 60, title: '日本一周が視野に', detail: '自宅を残して分割日本一周。貯蓄と収入継続の確認が前提。' },
  { amount: 80, title: '快適さを選べる', detail: '犬OK宿、急な帰宅、貯蓄や事業投資の選択肢が増える。' },
  { amount: 100, title: '挑戦と還元へ', detail: '長期滞在や教育・人材育成への投資を検討できる。' },
];

export default function IncomeFreedomSimulator() {
  const [netIncome, setNetIncome] = useState(60);
  const [rent, setRent] = useState(8);
  const [loan, setLoan] = useState(3);
  const [hotelNights, setHotelNights] = useState(4);
  // 2026-10-14 planning assumption: monthly travel 15 nights, two adults + one dog.
  // 52.5 = 47.83 baseline living/travel + ~3 loan + 1.5 parking + rounding.
  const expense = 52.5 + (rent - 8) + (loan - 3) + (hotelNights - 4) * 2.67;
  const remaining = netIncome - expense;
  const milestone = [...TARGETS].reverse().find(t => netIncome >= t.amount);
  const travelReady = remaining >= 7.5;
  return (
    <section className="income-freedom" aria-labelledby="income-freedom-heading">
      <style>{`
        .income-freedom{color:#262a2d;background:linear-gradient(128deg,#fffaf1 0%,#fff 52%,#f5f8fa 100%);border:1px solid #e5dfd5;border-radius:20px;padding:clamp(16px,3vw,30px);margin:0 0 30px;font-family:'Zen Kaku Gothic New',sans-serif}
        .income-freedom *{box-sizing:border-box}
        .income-freedom .income-top{display:flex;align-items:start;justify-content:space-between;gap:14px;flex-wrap:wrap}
        .income-freedom .eyebrow{font-size:10px;font-weight:700;letter-spacing:.16em;color:#9a682c}
        .income-freedom h2{font-size:clamp(22px,3vw,30px);font-weight:600;letter-spacing:-.04em;line-height:1.35;margin:8px 0}
        .income-freedom p{font-size:13px;line-height:1.9;color:#667078}
        .income-freedom .sheet-link{color:#996624;text-decoration:none;border-bottom:1px solid #d4c19f;font-size:12px;white-space:nowrap;padding:7px 0}
        .income-freedom .content-grid{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:22px;margin-top:24px}
        .income-freedom .input-panel,.income-freedom .result-panel{min-width:0;background:#fff;border:1px solid #e9e4db;border-radius:12px;padding:clamp(14px,2vw,22px)}
        .income-freedom label{display:flex;justify-content:space-between;align-items:center;gap:10px;color:#4b545a;font-size:12px;font-weight:600;margin-bottom:9px}
        .income-freedom label output{font-size:16px;color:#936123;font-variant-numeric:tabular-nums;white-space:nowrap}
        .income-freedom input[type=range]{width:100%;accent-color:#ad742d;cursor:pointer;min-height:28px}
        .income-freedom .field{margin-top:20px}
        .income-freedom .field:first-child{margin-top:0}
        .income-freedom .pills{display:flex;gap:7px;flex-wrap:wrap;margin-top:9px}
        .income-freedom .pills button{cursor:pointer;min-height:34px;border:1px solid #e0d7c8;background:#fff;border-radius:100px;padding:5px 13px;color:#64594a;font-size:12px}
        .income-freedom .pills button[aria-pressed=true]{background:#2a302e;color:#fff;border-color:#2a302e}
        .income-freedom .small{font-size:11px;color:#758087;line-height:1.8}
        .income-freedom .result-heading{font-size:11px;letter-spacing:.04em;color:#69737a;font-weight:600}
        .income-freedom .big{font-size:clamp(30px,4vw,46px);font-weight:600;line-height:1.2;margin:8px 0 20px;font-variant-numeric:tabular-nums}
        .income-freedom .metrics{display:grid;grid-template-columns:1fr 1fr;gap:9px}
        .income-freedom .metric{padding:13px;background:#f7f5f0;border-radius:8px}
        .income-freedom .metric span{display:block;color:#69737b;font-size:11px;margin-bottom:6px}
        .income-freedom .metric strong{font-size:clamp(16px,2vw,22px);font-weight:600;font-variant-numeric:tabular-nums}
        .income-freedom .status{margin-top:15px;padding:13px 14px;background:#f6f1e7;border-left:3px solid #ae7d39;font-size:12px;line-height:1.8}
        .income-freedom .status strong{display:block;margin-bottom:3px;color:#704b19}
        .income-freedom .timeline{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:20px}
        .income-freedom .step{border:1px solid #e7e1d8;padding:12px 10px;border-radius:10px;background:#fff;min-width:0}
        .income-freedom .step.on{border-color:#c6a578;background:#fbf5ec}
        .income-freedom .step small{font-size:10px;color:#8b682f}
        .income-freedom .step strong{display:block;font-size:12px;color:#303538;margin:6px 0}
        .income-freedom .step p{font-size:10px;line-height:1.65}
        .income-freedom .footnote{border-top:1px solid #e5dfd4;margin-top:20px;padding-top:13px;font-size:11px;line-height:1.8;color:#6b737b}
        @media(max-width:790px){.income-freedom .content-grid{grid-template-columns:1fr}.income-freedom .timeline{grid-template-columns:repeat(2,minmax(0,1fr))}.income-freedom .step:last-child{grid-column:1/-1}}
        @media(prefers-reduced-motion:reduce){.income-freedom *{scroll-behavior:auto}}
      `}</style>
      <div className="income-top">
        <div><div className="eyebrow">WANT TO / LIFE FREEDOM</div><h2 id="income-freedom-heading">手取りが増えたら、何ができる？</h2><p>収益の数字を「暮らしの選択肢」に変えるシミュレーション。</p></div>
        <a className="sheet-link" href="https://docs.google.com/spreadsheets/d/1gkYpIk28ScWY5xlFfkjyyBVa0Cmx3pl_oQuJ5sC8ij4/edit" target="_blank" rel="noopener noreferrer">Want to正本 ↗</a>
      </div>
      <div className="content-grid">
        <div className="input-panel">
          <div className="field">
            <label htmlFor="life-net">世帯の月間手取り <output htmlFor="life-net">{netIncome}万円</output></label>
            <input id="life-net" type="range" min="20" max="150" step="5" value={netIncome} onChange={event=>setNetIncome(Number(event.target.value))}/>
            <div className="pills" aria-label="手取りプリセット">{[30,45,60,80,100].map(amount=><button key={amount} type="button" aria-pressed={netIncome===amount} onClick={()=>setNetIncome(amount)}>{amount}万</button>)}</div>
            <p className="small">2人分の世帯手取り。税金・社会保険・事業経費を引いた後の金額。</p>
          </div>
          <div className="field">
            <label htmlFor="life-rent">自宅家賃 <output htmlFor="life-rent">{rent}万円 / 月</output></label>
            <input id="life-rent" type="range" min="6" max="15" step="1" value={rent} onChange={event=>setRent(Number(event.target.value))}/>
          </div>
          <div className="field">
            <label htmlFor="life-loan">車の返済 <output htmlFor="life-loan">{loan}万円 / 月</output></label>
            <input id="life-loan" type="range" min="0" max="10" step="0.5" value={loan} onChange={event=>setLoan(Number(event.target.value))}/>
          </div>
          <div className="field">
            <label htmlFor="life-hotel">犬OK宿 <output htmlFor="life-hotel">{hotelNights}泊 / 15泊</output></label>
            <input id="life-hotel" type="range" min="0" max="15" step="1" value={hotelNights} onChange={event=>setHotelNights(Number(event.target.value))}/>
            <p className="small">残りはRVパーク。犬OK宿3万円／泊、RVパーク3,300円／泊で差額を試算。</p>
          </div>
        </div>
        <div className="result-panel" aria-live="polite" aria-atomic="true">
          <div className="result-heading">月の手取り（想定）</div>
          <div className="big">{netIncome}万円</div>
          <div className="metrics">
            <div className="metric"><span>月の支出モデル</span><strong>{money(expense)}万円</strong></div>
            <div className="metric"><span>{remaining >= 0 ? '毎月残る金額' : '毎月の不足額'}</span><strong style={{color:remaining>=0?'#14754c':'#bd4e36'}}>{money(Math.abs(remaining))}万円</strong></div>
          </div>
          <div className="status">
            <strong>{remaining < 0 ? 'この旅モデルはまだ収支不足' : travelReady ? '日本一周生活の収支が見えてくる' : '生活費は賄えても余裕は小さい'}</strong>
            {remaining < 0 ? '車の購入や旅の頻度を見直し、継続収入を優先。' : travelReady ? 'ただし出発には、生活防衛資金と車の初期費用、手取りの継続実績が別途必要。' : '月々の修理・医療・売上変動に備え、すぐの出発は慎重に。'}
          </div>
          <p className="small" style={{marginTop:14}}>購入判定の参考：現金約400万円（頭金・装備・修理予備・生活防衛資金を含む）、雇用に頼らない収入が約6か月継続。現在の残高や実績は未連携。</p>
        </div>
      </div>
      <div className="timeline" aria-label="手取りで広がる暮らしの選択肢">
        {TARGETS.map(target=><div className={`step ${netIncome >= target.amount ? 'on' : ''}`} key={target.amount}>
          <small>{target.amount}万円〜 {netIncome>=target.amount?'｜想定範囲内':'｜次の目標'}</small>
          <strong>{target.title}</strong><p>{target.detail}</p>
        </div>)}
      </div>
      <p className="footnote">現在の到達段階：{milestone?.title ?? '生活基盤づくり'}。これは願望と予算をつなぐ例示であり、実際の所得・貯金・購入可能額・融資審査を判定するものではありません。家賃8万円、月15泊旅行（犬OK宿4泊）、車の返済3万円、駐車場1.5万円を基準にした2026年10月時点の会話上の概算です。入力値は送信・保存されません。</p>
    </section>
  );
}
