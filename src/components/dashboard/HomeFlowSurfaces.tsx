import {dashboardFlowSteps,dashboardOutputDoors} from '../../data/dashboardHome';

export function HomeFlowMap(){return <section className="flow-section" aria-labelledby="flow-title">
  <div className="section-head"><div><p className="kicker">FLOW</p><h2 id="flow-title">流れを見失った時だけ、ここへ戻る。</h2></div><p>循環の地図。</p></div>
  <div className="flow-track">{dashboardFlowSteps.map((step,index)=><a key={step.no} href={step.href} className="flow-step"><span className="no">{step.no}</span><div><small>{step.label}</small><strong>{step.title}</strong><em>{step.detail}</em></div>{index<dashboardFlowSteps.length-1&&<b aria-hidden="true">→</b>}</a>)}</div>
</section>}
export function HomeOutputDoors(){return <section className="output-section" id="output" aria-labelledby="output-title">
  <div className="section-head"><div><p className="kicker">OUTPUT</p><h2 id="output-title">外へ流す。</h2></div><p>まずPublishing Flowで順番を決める。公開はHuman Gate。</p></div>
  <div className="output-grid">{dashboardOutputDoors.map(door=><a key={door.href} className={'output-card '+door.className} href={door.href}><span>{door.mark}</span><div><strong>{door.title}</strong><small>{door.detail}</small></div><b>→</b></a>)}</div>
</section>}
