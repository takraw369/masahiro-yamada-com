(() => {
  const GENRES = [
    { id:'all', label:'すべて', themes:[['all','すべて','']] },
    { id:'ace', label:'ACE', themes:[['ace','ACE','ACE'],['education','教育','教育'],['talent','才能','才能'],['child','子ども','子ども']] },
    { id:'body', label:'身体・健康', themes:[['health','健康','健康'],['body','身体','身体'],['breath','呼吸','呼吸'],['food','食・薬膳','食'],['sport','競技・スポーツ','競技']] },
    { id:'mind', label:'心・認知', themes:[['confidence','自信','自信'],['redefine','RE:DEFINE','RE:DEFINE'],['emotion','感情','感情'],['habit','習慣','習慣'],['flow','FLOW / SLF','Flow']] },
    { id:'relations', label:'人・関係', themes:[['relations','人間関係','関係'],['en','縁','縁'],['listen','聴く','聴く'],['family','家族','家族']] },
    { id:'business', label:'価値・事業', themes:[['value','お金・価値','価値'],['product','商品・Offer','商品'],['content','発信・Content','発信'],['quest','Quest','Quest']] },
    { id:'principle', label:'哲学・原理', themes:[['philosophy','哲学・原理','原理'],['purpose','Purpose','Purpose'],['return','RETURN','RETURN'],['possibility','可能性','可能性']] },
  ];

  const ROLES = [
    ['all','すべて'],['core','コア'],['hook','Hook'],['safe','安心'],['question','問い'],['reframe','再定義'],
    ['education','教育'],['story','Story'],['quest','Quest'],['cta','CTA'],['reply','返信'],['restart','再開'],['offer','Offer'],
  ];

  const PURPOSES = [
    ['all','目的なし',[]],
    ['onboarding','入口',['safe','question','core','reply']],
    ['diagnosis','診断',['question','reply','reframe','education']],
    ['education','教育',['hook','education','reframe','quest']],
    ['quest','行動',['quest','reply','cta','safe']],
    ['offer','商品導線',['hook','story','offer','cta']],
    ['reactivate','再活性',['safe','restart','question','reply']],
  ];

  const state = {
    genre:'all', theme:'all', role:'all', purpose:'all', query:'', results:[], item:null,
    candidates:[], related:[], sources:[], sourceUrl:'', loading:false,
  };

  const $ = (q, root=document) => root.querySelector(q);
  const node = (tag, cls='', text='') => {
    const n=document.createElement(tag);
    if(cls)n.className=cls;
    if(text)n.textContent=text;
    return n;
  };
  const normalize = (value) => String(value || '').replace(/\\n/g,'\n').replace(/\r/g,'').trim();
  const compact = (value, max=180) => {
    const v=normalize(value).replace(/\s+/g,' ');
    return v.length > max ? `${v.slice(0,max)}…` : v;
  };

  function css(){
    if($('#line-asset-library-styles')) return;
    const s=node('style'); s.id='line-asset-library-styles'; s.textContent=`
      .la-launch{width:100%;border:1px solid #d9d3c9;background:#fff;border-radius:10px;padding:10px 11px;margin-top:8px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;text-align:left}.la-launch strong{font-size:11px}.la-launch small{display:block;color:#7f7a72;font-size:9px;margin-top:2px}
      .la-overlay{position:fixed;inset:0;z-index:120;background:#0005;display:none}.la-overlay.open{display:block}.la-drawer{position:absolute;inset:0 auto 0 0;width:min(640px,96vw);background:#f8f6f2;box-shadow:20px 0 50px #0002;display:grid;grid-template-rows:auto auto auto 1fr auto}
      .la-head{padding:17px;background:#fff;border-bottom:1px solid #ded8ce;display:flex;justify-content:space-between;gap:12px}.la-kicker{font-size:9px;letter-spacing:.13em;color:#95682f;font-weight:800}.la-head h2{font-size:21px;margin:3px 0}.la-head p,.la-foot small{font-size:9px;color:#77736c;margin:0;line-height:1.5}.la-close{width:40px;height:40px;border:0;border-radius:50%;background:#efebe5;font-size:20px}
      .la-search{padding:10px 13px;border-bottom:1px solid #e1dcd3;display:grid;gap:8px}.la-search input{height:44px;border:1px solid #d3cdc3;border-radius:9px;padding:0 12px;background:#fff;font-size:16px}.la-tax-row{display:grid;grid-template-columns:52px minmax(0,1fr);gap:7px;align-items:center}.la-tax-row>span{font-size:8px;color:#9a9388;letter-spacing:.08em}.la-chips,.la-roles,.la-purpose{display:flex;gap:6px;overflow:auto;scrollbar-width:none}.la-chips::-webkit-scrollbar,.la-roles::-webkit-scrollbar,.la-purpose::-webkit-scrollbar{display:none}.la-roles{padding:8px 13px;border-bottom:1px solid #e1dcd3}.la-chip{white-space:nowrap;border:1px solid #d7d1c8;background:#fff;border-radius:999px;padding:7px 10px;font-size:10px}.la-chip.on{background:#24282c;color:#fff;border-color:#24282c}
      .la-body{min-height:0;display:grid;grid-template-columns:minmax(180px,.9fr) minmax(0,1.35fr)}.la-results{overflow:auto;border-right:1px solid #ded8ce;padding:8px}.la-detail{overflow:auto;padding:11px;background:#fff}.la-result{width:100%;border:1px solid transparent;background:transparent;border-radius:9px;padding:9px;text-align:left;display:grid;gap:3px}.la-result.on,.la-result:hover{background:#fff;border-color:#ddd7ce}.la-result small{font-size:8px;color:#95682f}.la-result strong{font-size:11px;line-height:1.45}.la-result p{font-size:9px;color:#70736f;line-height:1.5;margin:0}.la-empty{padding:24px 10px;text-align:center;color:#88837a;font-size:10px;line-height:1.6}
      .la-detail h3{font-size:15px;line-height:1.45;margin:3px 0}.la-detail-head>p{font-size:10px;color:#666b6d;line-height:1.6;margin:0}.la-meta{display:flex;flex-wrap:wrap;gap:5px;margin-top:7px}.la-meta span{font-size:8px;color:#746c61;background:#f2efe9;border-radius:999px;padding:4px 7px}.la-links{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.la-links a{font-size:9px;text-decoration:none;color:#46617b;border:1px solid #d5dde4;background:#f8fbfd;padding:5px 7px;border-radius:7px}.la-card{border:1px solid #dfdad1;background:#fbfaf8;border-radius:10px;padding:10px;margin-top:8px}.la-card b{font-size:9px;color:#95682f}.la-card p{font-size:11px;line-height:1.65;white-space:pre-wrap;margin:6px 0 0}.la-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:8px}.la-actions button{border:1px solid #d5cfc6;background:#fff;border-radius:7px;padding:7px 8px;font-size:9px}.la-actions .primary{background:#24282c;color:#fff;border-color:#24282c}.la-related{margin-top:14px;padding-top:10px;border-top:1px solid #ebe6de}.la-related h4{font-size:9px;color:#8d8171;letter-spacing:.08em;margin:0 0 7px}.la-related-list{display:flex;gap:6px;flex-wrap:wrap}.la-related button{border:1px solid #ddd7cf;background:#fff;border-radius:8px;padding:6px 8px;font-size:9px;text-align:left}
      .la-foot{padding:9px 13px;border-top:1px solid #ded8ce;display:flex;justify-content:space-between;gap:8px;align-items:center}.la-foot a{font-size:9px;color:#4b6277;text-decoration:none}.la-toast{position:fixed;left:50%;bottom:24px;z-index:150;transform:translateX(-50%) translateY(10px);opacity:0;background:#25292d;color:#fff;border-radius:9px;padding:9px 13px;font-size:10px;transition:.18s}.la-toast.show{opacity:1;transform:translateX(-50%)}
      @media(max-width:760px){.la-drawer{inset:auto 0 0 0;width:100%;height:min(88vh,820px);border-radius:18px 18px 0 0}.la-body{grid-template-columns:1fr;grid-template-rows:minmax(150px,34%) 1fr}.la-results{border-right:0;border-bottom:1px solid #ded8ce}.la-head{padding:13px}.la-head h2{font-size:18px}.la-actions button{min-height:42px}.la-tax-row{grid-template-columns:44px minmax(0,1fr)}.la-foot{padding-bottom:max(10px,env(safe-area-inset-bottom))}}
    `; document.head.appendChild(s);
  }

  function toast(text){
    let t=$('.la-toast');
    if(!t){t=node('div','la-toast');document.body.appendChild(t)}
    t.textContent=text;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800);
  }

  function bridge(action, text, asset){
    const requestId=`la-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
    const handler=(event)=>{
      if(!(event instanceof CustomEvent)||event.detail?.requestId!==requestId)return;
      window.removeEventListener('masa:line-flow-asset-result',handler);
      toast(event.detail?.message || (event.detail?.ok ? '反映しました' : '反映できませんでした'));
    };
    window.addEventListener('masa:line-flow-asset-result',handler);
    window.dispatchEvent(new CustomEvent('masa:line-flow-asset',{detail:{action,text,asset,requestId}}));
    setTimeout(()=>window.removeEventListener('masa:line-flow-asset-result',handler),5200);
  }

  function selectedGenre(){return GENRES.find((item)=>item.id===state.genre)||GENRES[0]}
  function selectedTheme(){return selectedGenre().themes.find((item)=>item[0]===state.theme)||selectedGenre().themes[0]}
  function selectedPurpose(){return PURPOSES.find((item)=>item[0]===state.purpose)||PURPOSES[0]}

  function classifySentence(text,index){
    const v=normalize(text);
    if(!v)return 'core';
    if(/[？?]$/.test(v)||/^(なぜ|何|どんな|どう|いつ|どれ|今いちばん)/.test(v))return 'question';
    if(/返信|教えて|選んで|どれに|番号で/.test(v))return 'reply';
    if(/再開|戻る|止まった|久しぶり|また始め/.test(v))return 'restart';
    if(/申込|商品|プログラム|参加|購入|案内/.test(v))return 'offer';
    if(/次の入口|次へ|詳しく|見てみ|進みたい|こちら/.test(v))return 'cta';
    if(/Quest|クエスト|やってみ|試して|実践|今日.+(?:分|つ)|行動/.test(v))return 'quest';
    if(/経験|事例|昔|ある日|たとえば|例えば/.test(v))return 'story';
    if(/大丈夫|急が|焦ら|そのまま|まず.+観察|安心/.test(v))return 'safe';
    if(/ではなく|というより|再定義|つまり|本当は|とは[、。]/.test(v))return 'reframe';
    if(/理由|原理|仕組み|なぜなら|重要|ポイント|ということ/.test(v))return 'education';
    if(index<2)return 'hook';
    return 'core';
  }

  function candidates(item){
    const out=[],seen=new Set();
    const push=(role,label,text)=>{
      const v=normalize(text);
      if(v&&v.length>=6&&!seen.has(v)){seen.add(v);out.push({role,label,text:v})}
    };
    const labels={core:'コア',hook:'Hook',safe:'安心',question:'問い',reframe:'再定義',education:'教育',story:'Story',quest:'Quest',cta:'CTA',reply:'返信',restart:'再開',offer:'Offer'};
    push('core','コア',item.summary);
    const content=normalize(item.content);
    const markerRules=[
      ['hook','Hook',/(?:^|\n)(?:Hook|フック|冒頭)[：:]\s*([^\n]+)/gi],
      ['safe','安心',/(?:^|\n)(?:安心|共感)[：:]\s*([^\n]+)/g],
      ['question','問い',/(?:^|\n)(?:問い|質問)[：:]\s*([^\n]+)/g],
      ['reframe','再定義',/(?:^|\n)(?:MASA再定義|再定義)[：:]\s*([^\n]+)/g],
      ['education','教育',/(?:^|\n)(?:教育|原理|ポイント)[：:]\s*([^\n]+)/g],
      ['story','Story',/(?:^|\n)(?:Story|物語|事例)[：:]\s*([^\n]+)/gi],
      ['quest','Quest',/(?:^|\n)(?:24h\s*Quest|Quest|実践|行動)[：:]\s*([^\n]+)/gi],
      ['cta','CTA',/(?:^|\n)(?:CTA|次の一歩|次の入口)[：:]\s*([^\n]+)/gi],
      ['reply','返信',/(?:^|\n)(?:返信|Reply)[：:]\s*([^\n]+)/gi],
      ['restart','再開',/(?:^|\n)(?:再開|休眠)[：:]\s*([^\n]+)/g],
      ['offer','Offer',/(?:^|\n)(?:Offer|商品|案内)[：:]\s*([^\n]+)/gi],
    ];
    markerRules.forEach(([role,label,re])=>{let m;while((m=re.exec(content)))push(role,label,m[1])});

    if(content){
      const sentences=content
        .split(/\n{2,}|(?<=[。！？!?])\s+/)
        .map((v)=>normalize(v.replace(/^[-・*#>\s]+/,'')))
        .filter((v)=>v.length>=12&&v.length<=360)
        .slice(0,24);
      sentences.forEach((sentence,index)=>{
        const role=classifySentence(sentence,index);
        push(role,`${labels[role]||'コア'}候補`,sentence);
      });
    }
    if(!out.length&&content)push('core','本文',content.slice(0,600));
    return out.slice(0,32);
  }

  function purposeSort(list){
    const preferred=selectedPurpose()[2]||[];
    if(state.purpose==='all'||!preferred.length)return list;
    return [...list].sort((a,b)=>{
      const ai=preferred.indexOf(a.role),bi=preferred.indexOf(b.role);
      return (ai<0?99:ai)-(bi<0?99:bi);
    });
  }

  function getRelated(payload){
    const data=payload?.data;
    if(Array.isArray(data))return data;
    for(const key of ['related','knowledge','items','results'])if(Array.isArray(data?.[key]))return data[key];
    return [];
  }

  async function search(){
    state.loading=true;renderResults();
    const tq=selectedTheme()?.[2]||'';
    const q=state.query.trim()||tq;
    try{
      const r=await fetch(`/api/dashboard/knowledge?q=${encodeURIComponent(q)}&limit=50`,{headers:{Accept:'application/json'},credentials:'same-origin'});
      const p=await r.json();if(!r.ok||!p?.ok)throw 0;
      state.results=Array.isArray(p?.data?.knowledge)?p.data.knowledge:Array.isArray(p?.data)?p.data:[];
      state.item=null;state.candidates=[];state.related=[];state.sources=[];state.sourceUrl='';
    }catch{state.results=[];toast('Knowledgeを読み込めませんでした')}
    finally{state.loading=false;renderResults();renderDetail()}
  }

  async function select(item){
    state.item=item;state.candidates=[];state.related=[];state.sources=[];state.sourceUrl='';renderResults();renderDetail(true);
    try{
      const [detailResult,relatedResult]=await Promise.allSettled([
        fetch(`/api/dashboard/knowledge?id=${encodeURIComponent(item.id)}`,{headers:{Accept:'application/json'},credentials:'same-origin'}).then(async r=>({r,p:await r.json()})),
        fetch(`/api/dashboard/knowledge?related=${encodeURIComponent(item.id)}&limit=12`,{headers:{Accept:'application/json'},credentials:'same-origin'}).then(async r=>({r,p:await r.json()})),
      ]);
      if(detailResult.status!=='fulfilled'||!detailResult.value.r.ok||!detailResult.value.p?.ok||!detailResult.value.p?.data?.item)throw 0;
      state.item=detailResult.value.p.data.item;
      state.candidates=candidates(state.item);
      state.sources=Array.isArray(detailResult.value.p.data.sources)?detailResult.value.p.data.sources:[];
      state.sourceUrl=state.sources.find(x=>x?.source_url)?.source_url||'';
      if(relatedResult.status==='fulfilled'&&relatedResult.value.r.ok&&relatedResult.value.p?.ok)state.related=getRelated(relatedResult.value.p).filter(x=>x?.id&&x.id!==state.item.id).slice(0,10);
    }catch{toast('この資産の詳細を開けませんでした')}
    renderDetail();
  }

  function renderResults(){
    const root=$('.la-results');if(!root)return;root.textContent='';
    if(state.loading){root.append(node('div','la-empty','Knowledgeを探しています…'));return}
    if(!state.results.length){root.append(node('div','la-empty','一致する資産がありません。検索語やテーマを変えてください。'));return}
    state.results.forEach(x=>{
      const b=node('button',`la-result ${state.item?.id===x.id?'on':''}`);b.type='button';
      b.append(node('small','',[x.domain,x.item_type].filter(Boolean).join(' · ')),node('strong','',x.title||'Untitled'),node('p','',compact(x.summary||'要約なし',120)));
      b.onclick=()=>select(x);root.append(b);
    });
  }

  function link(label,href,newTab=true){
    const a=node('a','',label);a.href=href;
    if(newTab){a.target='_blank';a.rel='noopener noreferrer'}
    return a;
  }

  function readableDate(value){
    if(!value)return '';
    const d=new Date(value);if(Number.isNaN(d.getTime()))return '';
    return d.toLocaleDateString('ja-JP',{year:'numeric',month:'short',day:'numeric'});
  }

  function renderDetail(loading=false){
    const root=$('.la-detail');if(!root)return;root.textContent='';
    if(!state.item){root.append(node('div','la-empty','左から資産を選ぶと、Drive正本のKnowledgeをLINE用の役割別メッセージ候補に分解します。'));return}
    const h=node('div','la-detail-head');
    h.append(node('small','la-kicker',[state.item.domain,state.item.item_type].filter(Boolean).join(' · ')),node('h3','',state.item.title||'Untitled'),node('p','',state.item.summary||''));
    const meta=node('div','la-meta');
    if(state.sourceUrl)meta.append(node('span','','Drive原本あり'));
    const updated=readableDate(state.item.updated_at||state.item.created_at||state.sources.find(x=>x?.updated_at)?.updated_at);
    if(updated)meta.append(node('span','',`Knowledge更新 ${updated}`));
    meta.append(node('span','',`候補 ${state.candidates.length}`));
    h.append(meta);
    const links=node('div','la-links');
    links.append(
      link('FLOW MIND ↗',`/dashboard/knowledge?q=${encodeURIComponent(state.item.title||'')}`),
      link('GRAPH ↗',`/dashboard/graph?q=${encodeURIComponent(state.item.title||'')}&from=line`),
      link('PRIMARY / Lian ↗','/dashboard/lian',false),
    );
    if(state.sourceUrl)links.append(link('DRIVE原本 ↗',state.sourceUrl));
    h.append(links);root.append(h);
    if(loading){root.append(node('div','la-empty','本文・Source・関連Knowledgeを読み込み中…'));return}

    let list=state.role==='all'?state.candidates:state.candidates.filter(x=>x.role===state.role);
    list=purposeSort(list);
    if(!list.length){root.append(node('div','la-empty','この役割の候補はありません。「すべて」に戻すか別の資産を選んでください。'))}
    list.forEach(c=>{
      const card=node('article','la-card');card.append(node('b','',c.label),node('p','',c.text));
      const actions=node('div','la-actions');
      const put=node('button','primary','本文に置く'),app=node('button','','＋ 追記'),step=node('button','','新Step');
      put.type=app.type=step.type='button';
      const asset={id:state.item.id,title:state.item.title,role:c.role,sourceUrl:state.sourceUrl};
      put.onclick=()=>bridge('replace',c.text,asset);app.onclick=()=>bridge('append',c.text,asset);step.onclick=()=>bridge('new-step',c.text,asset);
      actions.append(put,app,step);card.append(actions);root.append(card);
    });

    if(state.related.length){
      const related=node('section','la-related');related.append(node('h4','','RELATED KNOWLEDGE'));
      const listRoot=node('div','la-related-list');
      state.related.forEach(item=>{const b=node('button','','');b.type='button';b.textContent=item.title||item.label||'関連Knowledge';b.onclick=()=>select(item);listRoot.append(b)});
      related.append(listRoot);root.append(related);
    }
  }

  function chips(root,items,key,paint,onPick){
    root.textContent='';
    items.forEach(([id,label])=>{
      const b=node('button',`la-chip ${state[key]===id?'on':''}`,label);b.type='button';
      b.onclick=()=>{state[key]=id;paint();onPick?.(id)};root.append(b);
    });
  }

  function paintThemes(root,input){
    const themes=selectedGenre().themes;
    if(!themes.some(([id])=>id===state.theme))state.theme=themes[0][0];
    const paint=()=>chips(root,themes,'theme',paint,()=>{state.query='';input.value='';search()});
    paint();
  }

  function taxonomyRow(label,content){const row=node('div','la-tax-row');row.append(node('span','',label),content);return row}

  function build(){
    css();if($('.la-overlay'))return;
    const o=node('div','la-overlay'),d=node('section','la-drawer'),h=node('div','la-head'),copy=node('div'),close=node('button','la-close','×');
    copy.append(node('div','la-kicker','DRIVE → KNOWLEDGE → LINE'),node('h2','','Message Asset Library'),node('p','','正本はDrive。ここではテーマ・目的・役割で探してFlowへ再利用します。'));
    close.type='button';close.onclick=()=>o.classList.remove('open');h.append(copy,close);

    const s=node('div','la-search'),input=node('input');input.type='search';input.placeholder='言葉で検索　例：自信 / 呼吸 / 教育 / 関係';
    let timer=0;input.oninput=()=>{state.query=input.value;clearTimeout(timer);timer=setTimeout(search,240)};

    const genreRoot=node('div','la-chips'),themeRoot=node('div','la-chips'),purposeRoot=node('div','la-purpose');
    const paintGenre=()=>chips(genreRoot,GENRES.map(g=>[g.id,g.label]),'genre',paintGenre,()=>{state.theme=selectedGenre().themes[0][0];paintThemes(themeRoot,input);state.query='';input.value='';search()});
    paintGenre();paintThemes(themeRoot,input);
    const paintPurpose=()=>chips(purposeRoot,PURPOSES.map(([id,label])=>[id,label]),'purpose',paintPurpose,()=>renderDetail());paintPurpose();
    s.append(input,taxonomyRow('ジャンル',genreRoot),taxonomyRow('テーマ',themeRoot),taxonomyRow('目的',purposeRoot));

    const roles=node('div','la-roles');const paintR=()=>chips(roles,ROLES,'role',paintR,()=>renderDetail());paintR();
    const body=node('div','la-body');body.append(node('div','la-results'),node('div','la-detail'));
    const f=node('div','la-foot');f.append(node('small','','Drive原本は複製しない。Knowledge経由で再利用。'),link('FLOW MINDを開く ↗','/dashboard/knowledge'));
    d.append(h,s,roles,body,f);o.append(d);o.onmousedown=e=>{if(e.target===o)o.classList.remove('open')};document.body.append(o);renderResults();renderDetail();
    document.addEventListener('keydown',e=>{if(e.key==='Escape')o.classList.remove('open')});
  }

  function launcher(){
    const left=$('.left');if(!left||$('.la-launch',left))return false;
    const b=node('button','la-launch');b.type='button';const c=node('span');
    c.append(node('strong','','ASSET LIBRARY'),node('small','','ジャンル × テーマ × 目的 × Drive資産'));
    b.append(c,node('span','','↗'));b.onclick=()=>{build();$('.la-overlay')?.classList.add('open');if(!state.results.length)search()};left.append(b);return true;
  }

  function boot(){
    build();
    const params=new URLSearchParams(location.search);const q=params.get('assetQ')?.trim();
    if(q){state.query=q;const input=$('.la-search input');if(input)input.value=q;$('.la-overlay')?.classList.add('open');search()}
    if(launcher())return;
    const mo=new MutationObserver(()=>{if(launcher())mo.disconnect()});mo.observe(document.documentElement,{childList:true,subtree:true});setTimeout(()=>mo.disconnect(),12000);
  }

  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot,{once:true}):boot();
})();
