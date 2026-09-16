(() => {
  const THEMES = [
    ['all','すべて',''],['ace','ACE','ACE'],['redefine','RE:DEFINE','RE:DEFINE'],['education','教育','教育'],
    ['health','身体・健康','健康'],['flow','FLOW / SLF','Flow'],['confidence','自信・自己理解','自信'],
    ['relations','人間関係','関係'],['learning','学習・才能','才能'],['value','お金・価値','価値'],
    ['quest','Quest','Quest'],['philosophy','哲学・原理','原理'],
  ];
  const ROLES = [['all','すべて'],['core','コア'],['question','問い'],['reframe','再定義'],['quest','Quest'],['expand','展開']];
  const state = { theme:'all', role:'all', query:'', results:[], item:null, candidates:[], sourceUrl:'', loading:false };
  const $ = (q, root=document) => root.querySelector(q);
  const node = (tag, cls='', text='') => { const n=document.createElement(tag); if(cls)n.className=cls; if(text)n.textContent=text; return n; };

  function css(){
    if($('#line-asset-library-styles')) return;
    const s=node('style'); s.id='line-asset-library-styles'; s.textContent=`
      .la-launch{width:100%;border:1px solid #d9d3c9;background:#fff;border-radius:10px;padding:10px 11px;margin-top:8px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;text-align:left}.la-launch strong{font-size:11px}.la-launch small{display:block;color:#7f7a72;font-size:9px;margin-top:2px}
      .la-overlay{position:fixed;inset:0;z-index:120;background:#0005;display:none}.la-overlay.open{display:block}.la-drawer{position:absolute;inset:0 auto 0 0;width:min(540px,94vw);background:#f8f6f2;box-shadow:20px 0 50px #0002;display:grid;grid-template-rows:auto auto auto 1fr auto}
      .la-head{padding:17px;background:#fff;border-bottom:1px solid #ded8ce;display:flex;justify-content:space-between;gap:12px}.la-kicker{font-size:9px;letter-spacing:.13em;color:#95682f;font-weight:800}.la-head h2{font-size:21px;margin:3px 0}.la-head p,.la-foot small{font-size:9px;color:#77736c;margin:0;line-height:1.5}.la-close{width:40px;height:40px;border:0;border-radius:50%;background:#efebe5;font-size:20px}
      .la-search{padding:10px 13px;border-bottom:1px solid #e1dcd3;display:grid;gap:8px}.la-search input{height:44px;border:1px solid #d3cdc3;border-radius:9px;padding:0 12px;background:#fff;font-size:16px}.la-chips,.la-roles{display:flex;gap:6px;overflow:auto}.la-roles{padding:8px 13px;border-bottom:1px solid #e1dcd3}.la-chip{white-space:nowrap;border:1px solid #d7d1c8;background:#fff;border-radius:999px;padding:7px 10px;font-size:10px}.la-chip.on{background:#24282c;color:#fff;border-color:#24282c}
      .la-body{min-height:0;display:grid;grid-template-columns:1fr 1.1fr}.la-results{overflow:auto;border-right:1px solid #ded8ce;padding:8px}.la-detail{overflow:auto;padding:11px;background:#fff}.la-result{width:100%;border:1px solid transparent;background:transparent;border-radius:9px;padding:9px;text-align:left;display:grid;gap:3px}.la-result.on,.la-result:hover{background:#fff;border-color:#ddd7ce}.la-result small{font-size:8px;color:#95682f}.la-result strong{font-size:11px;line-height:1.45}.la-result p{font-size:9px;color:#70736f;line-height:1.5;margin:0}.la-empty{padding:24px 10px;text-align:center;color:#88837a;font-size:10px;line-height:1.6}
      .la-detail h3{font-size:15px;line-height:1.45;margin:3px 0}.la-detail-head>p{font-size:10px;color:#666b6d;line-height:1.6;margin:0}.la-links{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.la-links a{font-size:9px;text-decoration:none;color:#46617b;border:1px solid #d5dde4;background:#f8fbfd;padding:5px 7px;border-radius:7px}.la-card{border:1px solid #dfdad1;background:#fbfaf8;border-radius:10px;padding:10px;margin-top:8px}.la-card b{font-size:9px;color:#95682f}.la-card p{font-size:11px;line-height:1.65;white-space:pre-wrap;margin:6px 0 0}.la-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.la-actions button{border:1px solid #d5cfc6;background:#fff;border-radius:7px;padding:7px 8px;font-size:9px}.la-actions .primary{background:#24282c;color:#fff;border-color:#24282c}
      .la-foot{padding:9px 13px;border-top:1px solid #ded8ce;display:flex;justify-content:space-between;gap:8px;align-items:center}.la-foot a{font-size:9px;color:#4b6277;text-decoration:none}.la-toast{position:fixed;left:50%;bottom:24px;z-index:150;transform:translateX(-50%) translateY(10px);opacity:0;background:#25292d;color:#fff;border-radius:9px;padding:9px 13px;font-size:10px;transition:.18s}.la-toast.show{opacity:1;transform:translateX(-50%)}
      @media(max-width:760px){.la-drawer{inset:auto 0 0 0;width:100%;height:min(84vh,780px);border-radius:18px 18px 0 0}.la-body{grid-template-columns:1fr;grid-template-rows:minmax(160px,40%) 1fr}.la-results{border-right:0;border-bottom:1px solid #ded8ce}.la-head{padding:13px}.la-head h2{font-size:18px}.la-actions button{min-height:40px}.la-foot{padding-bottom:max(10px,env(safe-area-inset-bottom))}}
    `; document.head.appendChild(s);
  }
  function toast(text){ let t=$('.la-toast'); if(!t){t=node('div','la-toast');document.body.appendChild(t)} t.textContent=text;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800); }
  function textarea(){ return $('.inspect textarea'); }
  function setText(value, append=false){
    const t=textarea(); if(!t){toast('先にStepを選んでください');return}
    const next=append&&t.value.trim()?`${t.value.trim()}\n\n${value}`:value;
    const d=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value'); d?.set?d.set.call(t,next):t.value=next;
    t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new Event('change',{bubbles:true}));t.focus();toast(append?'本文へ追記しました':'本文へ置きました');
  }
  function newStep(text){
    const add=$('.add'); if(!(add instanceof HTMLElement)){toast('Flowを選んでください');return}
    const before=document.querySelectorAll('.step').length; add.click(); const start=Date.now();
    const timer=setInterval(()=>{ const t=textarea(); if(t&&(document.querySelectorAll('.step').length>before||Date.now()-start>700)){clearInterval(timer);setText(text);toast('新Stepへ入れました。保存で確定します')} if(Date.now()-start>4500){clearInterval(timer)} },120);
  }
  function candidates(item){
    const out=[],seen=new Set(); const push=(role,label,text)=>{const v=String(text||'').replace(/\\n/g,'\n').trim();if(v&&!seen.has(v)){seen.add(v);out.push({role,label,text:v})}};
    push('core','コア',item.summary); const c=String(item.content||'').replace(/\\n/g,'\n');
    [['question','問い',/(?:^|\n)問い[：:]\s*([^\n]+)/g],['reframe','再定義',/(?:^|\n)(?:MASA再定義|再定義)[：:]\s*([^\n]+)/g],['quest','Quest',/(?:^|\n)(?:24h\s*Quest|Quest)[：:]\s*([^\n]+)/gi],['expand','展開',/(?:^|\n)展開[：:]\s*([^\n]+)/g]].forEach(([r,l,re])=>{let m;while((m=re.exec(c)))push(r,l,m[1])});
    if(!out.length&&c.trim())push('core','本文',c.slice(0,600)); return out;
  }
  async function search(){
    state.loading=true;renderResults(); const tq=THEMES.find(x=>x[0]===state.theme)?.[2]||''; const q=state.query.trim()||tq;
    try{const r=await fetch(`/api/dashboard/knowledge?q=${encodeURIComponent(q)}&limit=50`,{headers:{Accept:'application/json'},credentials:'same-origin'});const p=await r.json();if(!r.ok||!p?.ok)throw 0;state.results=Array.isArray(p?.data?.knowledge)?p.data.knowledge:[];state.item=null;state.candidates=[];state.sourceUrl=''}catch{state.results=[];toast('Knowledgeを読み込めませんでした')}finally{state.loading=false;renderResults();renderDetail()}
  }
  async function select(item){
    state.item=item;state.candidates=[];state.sourceUrl='';renderResults();renderDetail(true);
    try{const r=await fetch(`/api/dashboard/knowledge?id=${encodeURIComponent(item.id)}`,{headers:{Accept:'application/json'},credentials:'same-origin'});const p=await r.json();if(!r.ok||!p?.ok||!p?.data?.item)throw 0;state.item=p.data.item;state.candidates=candidates(p.data.item);const ss=Array.isArray(p.data.sources)?p.data.sources:[];state.sourceUrl=ss.find(x=>x?.source_url)?.source_url||''}catch{toast('この資産の詳細を開けませんでした')} renderDetail();
  }
  function renderResults(){
    const root=$('.la-results');if(!root)return;root.textContent='';if(state.loading){root.append(node('div','la-empty','Knowledgeを探しています…'));return}if(!state.results.length){root.append(node('div','la-empty','一致する資産がありません。検索語やテーマを変えてください。'));return}
    state.results.forEach(x=>{const b=node('button',`la-result ${state.item?.id===x.id?'on':''}`);b.type='button';b.append(node('small','',[x.domain,x.item_type].filter(Boolean).join(' · ')),node('strong','',x.title||'Untitled'),node('p','',x.summary||'要約なし'));b.onclick=()=>select(x);root.append(b)});
  }
  function link(label,href){const a=node('a','',label);a.href=href;a.target='_blank';a.rel='noopener noreferrer';return a}
  function renderDetail(loading=false){
    const root=$('.la-detail');if(!root)return;root.textContent='';if(!state.item){root.append(node('div','la-empty','左から資産を選ぶと、LINEで使える「コア・問い・再定義・Quest」に分解して出します。'));return}
    const h=node('div','la-detail-head');h.append(node('small','la-kicker',[state.item.domain,state.item.item_type].filter(Boolean).join(' · ')),node('h3','',state.item.title||'Untitled'),node('p','',state.item.summary||''));const links=node('div','la-links');links.append(link('FLOW MIND ↗',`/dashboard/knowledge?q=${encodeURIComponent(state.item.title||'')}`),link('GRAPH ↗','/dashboard/graph'));if(state.sourceUrl)links.append(link('DRIVE原本 ↗',state.sourceUrl));h.append(links);root.append(h);
    if(loading){root.append(node('div','la-empty','本文とSourceを読み込み中…'));return} const list=state.role==='all'?state.candidates:state.candidates.filter(x=>x.role===state.role);if(!list.length){root.append(node('div','la-empty','この分類の候補はありません。「すべて」に戻してください。'));return}
    list.forEach(c=>{const card=node('article','la-card');card.append(node('b','',c.label),node('p','',c.text));const a=node('div','la-actions');const put=node('button','primary','本文に置く'),app=node('button','','＋ 追記'),step=node('button','','新Step');put.type=app.type=step.type='button';put.onclick=()=>setText(c.text);app.onclick=()=>setText(c.text,true);step.onclick=()=>newStep(c.text);a.append(put,app,step);card.append(a);root.append(card)});
  }
  function chips(root,items,key,paint,onPick){root.textContent='';items.forEach(([id,label])=>{const b=node('button',`la-chip ${state[key]===id?'on':''}`,label);b.type='button';b.onclick=()=>{state[key]=id;paint();onPick?.(id)};root.append(b)})}
  function build(){
    css();if($('.la-overlay'))return;const o=node('div','la-overlay'),d=node('section','la-drawer'),h=node('div','la-head'),copy=node('div'),close=node('button','la-close','×');copy.append(node('div','la-kicker','DRIVE × KNOWLEDGE × LINE'),node('h2','','Message Asset Library'),node('p','','Drive正本 → Supabase Knowledgeを、LINEで使える言葉へ。'));close.type='button';close.onclick=()=>o.classList.remove('open');h.append(copy,close);
    const s=node('div','la-search'),input=node('input');input.type='search';input.placeholder='テーマ・言葉を検索　例：自信 / 教育 / Flow';let timer=0;input.oninput=()=>{state.query=input.value;clearTimeout(timer);timer=setTimeout(search,220)};const tc=node('div','la-chips');const paintT=()=>chips(tc,THEMES,'theme',paintT,()=>{state.query='';input.value='';search()});paintT();s.append(input,tc);
    const roles=node('div','la-roles');const paintR=()=>chips(roles,ROLES,'role',paintR,()=>renderDetail());paintR();const body=node('div','la-body');body.append(node('div','la-results'),node('div','la-detail'));const f=node('div','la-foot');f.append(node('small','','原本はDrive。ここは検索・再利用の派生ビュー。'),link('FLOW MINDを開く ↗','/dashboard/knowledge'));d.append(h,s,roles,body,f);o.append(d);o.onmousedown=e=>{if(e.target===o)o.classList.remove('open')};document.body.append(o);renderResults();renderDetail();document.addEventListener('keydown',e=>{if(e.key==='Escape')o.classList.remove('open')});
  }
  function launcher(){const left=$('.left');if(!left||$('.la-launch',left))return false;const b=node('button','la-launch');b.type='button';const c=node('span');c.append(node('strong','','ASSET LIBRARY'),node('small','','ジャンル・テーマ・Drive資産から選ぶ'));b.append(c,node('span','','↗'));b.onclick=()=>{build();$('.la-overlay')?.classList.add('open');if(!state.results.length)search()};left.append(b);return true}
  function boot(){build();if(launcher())return;const mo=new MutationObserver(()=>{if(launcher())mo.disconnect()});mo.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>mo.disconnect(),12000)}
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
