import { useMemo, useState } from 'react';
import {
  calculatePbjScenario,
  calculateTravelPolicy,
  DEFAULT_PBJ_SCENARIO,
  DEFAULT_PBJ_TRAVEL,
  type PbjScenario,
  type PbjTravelPolicy,
} from '../../lib/pbjSimulator';
import '../../styles/pbj-simulator.css';

const man = (value: number): string =>
  new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 1 }).format(value) + '万円';
const yen = (value: number): string =>
  new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 }).format(value) + '円';
const hrs = (value: number | null): string => value === null ? '算定不可' : Math.ceil(value).toLocaleString('ja-JP') + '時間';

type SliderProps = {
  id: string; title: string; value: number; min: number; max: number; step: number;
  display: (value: number) => string; onChange: (value: number) => void;
};
function RangeField({ id, title, value, min, max, step, display, onChange }: SliderProps) {
  return <div className="pbj-field">
    <label htmlFor={id}><span>{title}</span><output htmlFor={id}>{display(value)}</output></label>
    <input id={id} type="range" min={min} max={max} step={step} value={value}
      onChange={event => onChange(Number(event.target.value))} />
  </div>;
}
function NumberField({ id, title, value, step, onChange, note }: {
  id: string; title: string; value: number; step: number; onChange: (value: number) => void; note?: string;
}) {
  return <label className="pbj-number-field" htmlFor={id}>
    <span>{title}</span>
    <span className="pbj-number-entry">
      <input id={id} inputMode="decimal" type="number" min={0} step={step} value={value}
        onChange={event => onChange(Math.max(0, Number(event.target.value) || 0))} />
      <span className="pbj-unit">{note || '万円'}</span>
    </span>
  </label>;
}

export default function PbjAssetSimulator() {
  const [travel, setTravel] = useState<PbjTravelPolicy>(DEFAULT_PBJ_TRAVEL);
  const [scenario, setScenario] = useState<PbjScenario>(DEFAULT_PBJ_SCENARIO);
  const tripResult = useMemo(() => calculateTravelPolicy(travel), [travel]);
  const results = useMemo(() => calculatePbjScenario(scenario), [scenario]);
  const updateTravel = (key: keyof PbjTravelPolicy, value: number) =>
    setTravel(current => ({ ...current, [key]: value }));
  const updateScenario = (key: keyof PbjScenario, value: number) =>
    setScenario(current => ({ ...current, [key]: value }));
  const sensitivity = [100, 200, 300].map(hours => ({
    hours, ...calculatePbjScenario({ ...scenario, externalHours: hours }),
  }));

  return <section id="pbj-simulator" className="pbj-simulator" aria-labelledby="pbj-title">
    <header className="pbj-header">
      <div>
        <span className="pbj-eyebrow">CAPITAL FLOW LAB / BUSINESS ASSET</span>
        <h2 id="pbj-title">PBJ × 旅費規程シミュレーター</h2>
        <p>ACEが借りる・PBJ保有会社が貸す・外部顧客にも提供する。社内承認予算と運航収支を別々に検証するための仮説モデル。</p>
      </div>
      <span className="pbj-state">試算のみ・未承認</span>
    </header>

    <div className="pbj-group-title"><span>01</span><h3>出張見積と会社負担の上限</h3></div>
    <div className="pbj-two-col">
      <div className="pbj-panel">
        <RangeField id="pbj-quote" title="PBJ実利用料金（見積）" value={travel.quoteMan}
          min={0} max={2000} step={50} display={man}
          onChange={v => updateTravel('quoteMan', v)}/>
        <RangeField id="pbj-cap" title="ACEの事前承認上限" value={travel.approvedCapMan}
          min={0} max={2000} step={50} display={man}
          onChange={v => updateTravel('approvedCapMan', v)}/>
        <RangeField id="pbj-allowance" title="出張日当（1日あたり）" value={travel.dailyAllowanceYen}
          min={0} max={30000} step={1000} display={yen}
          onChange={v => updateTravel('dailyAllowanceYen', v)}/>
        <RangeField id="pbj-days" title="日当対象日数" value={travel.allowanceDays}
          min={0} max={14} step={1} display={v => v + '日'}
          onChange={v => updateTravel('allowanceDays', v)}/>
        <button type="button" className="pbj-reset" onClick={() => setTravel(DEFAULT_PBJ_TRAVEL)}>旅費の初期値に戻す</button>
      </div>
      <div className="pbj-panel pbj-output-panel">
        <div className="pbj-primary-output"><span>ACEが負担する予定額（交通費・上限内）</span><strong aria-live="polite">{man(tripResult.approvedMan)}</strong></div>
        <div className="pbj-stat-grid">
          <div><span>超過額・追加承認待ち</span><strong>{man(tripResult.pendingMan)}</strong></div>
          <div><span>出張日当の合計</span><strong>{yen(tripResult.allowanceYen)}</strong></div>
          <div><span>交通費と日当の会社予算合計</span><strong>{man(tripResult.plannedCompanyCashMan)}</strong></div>
        </div>
        <p className="pbj-note">承認上限は社内予算であり、全額の税務上の損金算入を保証しません。超過分が自動的にMASA個人の負担になるわけでもありません。追加承認・契約条件・実際の利用内容で判断します。</p>
      </div>
    </div>

    <div className="pbj-group-title"><span>02</span><h3>保有会社とグループ全体の収支</h3></div>
    <div className="pbj-two-col">
      <div className="pbj-panel">
        <div className="pbj-number-grid">
          <NumberField id="pbj-price" title="機体購入価格" value={scenario.purchasePriceMan} step={1000} note="万円"
            onChange={v => updateScenario('purchasePriceMan', v)}/>
          <NumberField id="pbj-fixed" title="年間固定費" value={scenario.fixedAnnualMan} step={500}
            onChange={v => updateScenario('fixedAnnualMan', v)}/>
          <NumberField id="pbj-variable" title="飛行時間あたり変動費" value={scenario.variablePerHourMan} step={5}
            onChange={v => updateScenario('variablePerHourMan', v)}/>
          <NumberField id="pbj-rate" title="外部への提供単価・純受取" value={scenario.externalRateMan} step={5}
            onChange={v => updateScenario('externalRateMan', v)}/>
          <NumberField id="pbj-hours" title="外部販売時間／年" value={scenario.externalHours} step={10} note="時間"
            onChange={v => updateScenario('externalHours', v)}/>
          <NumberField id="pbj-ace-hours" title="ACEの利用時間／年" value={scenario.aceHours} step={5} note="時間"
            onChange={v => updateScenario('aceHours', v)}/>
          <NumberField id="pbj-ace-rate" title="ACEの時間あたり利用料" value={scenario.aceRateMan} step={5}
            onChange={v => updateScenario('aceRateMan', v)}/>
          <NumberField id="pbj-debt" title="借入比率" value={scenario.debtPct} step={5} note="%"
            onChange={v => updateScenario('debtPct', Math.min(v, 100))}/>
          <NumberField id="pbj-interest" title="借入年利" value={scenario.interestPct} step={0.5} note="%"
            onChange={v => updateScenario('interestPct', v)}/>
          <NumberField id="pbj-personal-hours" title="個人利用時間／年" value={scenario.personalHours} step={5} note="時間"
            onChange={v => updateScenario('personalHours', v)}/>
        </div>
        <button type="button" className="pbj-reset" onClick={() => setScenario(DEFAULT_PBJ_SCENARIO)}>保有モデルの初期値に戻す</button>
      </div>
      <div className="pbj-panel pbj-output-panel">
        <div className="pbj-cash-grid">
          <div><span>保有会社の現金収支</span><strong>{man(results.ownerCashMan)}</strong><small>税・元本返済前／利息後</small></div>
          <div><span>事業グループの現金収支</span><strong>{man(results.groupCashMan)}</strong><small>ACE利用料は内部取引として除外</small></div>
        </div>
        <dl className="pbj-ledger">
          <div><dt>外部チャーター純売上</dt><dd>{man(results.externalRevenueMan)}</dd></div>
          <div><dt>ACE利用料（グループ内部）</dt><dd>{man(results.aceInternalRevenueMan)}</dd></div>
          <div><dt>年間飛行時間（合計）</dt><dd>{results.totalHours.toLocaleString('ja-JP')}時間</dd></div>
          <div><dt>変動費・年間固定費</dt><dd>{man(results.variableCostMan + results.fixedAnnualMan)}</dd></div>
          <div><dt>借入利息（単純仮定）</dt><dd>{man(results.interestMan)}</dd></div>
          <div><dt>減価償却（5年仮定）</dt><dd>{man(results.depreciationMan)}</dd></div>
          <div><dt>保有会社の会計上の損益（仮）</dt><dd>{man(results.ownerAccountingMan)}</dd></div>
          <div><dt>初期自己資金（借入比率仮定）</dt><dd>{man(results.initialEquityMan)}</dd></div>
        </dl>
        <div className="pbj-break-even">
          <div><span>保有会社の現金収支均衡</span><strong>{hrs(results.ownerBreakEvenHours)}</strong></div>
          <div><span>グループの現金収支均衡</span><strong>{hrs(results.groupBreakEvenHours)}</strong></div>
        </div>
        <p className="pbj-note">外部チャーターの販売可能時間は未検証。機体残価・売却課税・消費税・借入元本返済・回送・大型整備などを含まない簡便モデルです。関連会社への請求は適正価格と実際の契約・支払いが前提です。</p>
      </div>
    </div>

    <div className="pbj-group-title"><span>03</span><h3>販売稼働時間の感度分析</h3></div>
    <div className="pbj-panel pbj-scroll" tabIndex={0} aria-label="外部チャーター販売時間別の収支テーブル">
      <table>
        <thead><tr><th scope="col">外部販売時間</th><th scope="col">保有会社の現金収支</th><th scope="col">グループの現金収支</th></tr></thead>
        <tbody>{sensitivity.map(item => <tr key={item.hours}>
          <th scope="row">{item.hours}時間</th><td>{man(item.ownerCashMan)}</td><td>{man(item.groupCashMan)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <footer className="pbj-footer">
      <p><strong>Human Gate：</strong>機体購入・事業契約・航空事業開始・旅費規程の施行は未承認。この画面の入力・試算で外部処理は発生しません。MAHRUの飛行適性は獣医師評価を優先。</p>
      <p><a href="https://docs.google.com/document/d/1xFTmJGltvXFFojFzg-2dsSQRz4_h3_QqvUbRgJsitbg/edit" target="_blank" rel="noreferrer noopener">PBJ事業構想・確認項目（Drive）↗</a>　<a href="https://docs.google.com/spreadsheets/d/1qsnOr4dXBuFqDd3193iZHEDffXg-UUBYShHrljzaF7o/edit" target="_blank" rel="noreferrer noopener">計算モデルの正本（Drive）↗</a></p>
    </footer>
  </section>;
}
