(() => {
  'use strict';
  const C=window.OTSU4_TOPIC_TESTS,$=id=>document.getElementById(id);
  const rows=OTSU4_QUESTIONS,byId=new Map(rows.map(q=>[q.id,q]));
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let topic=C.topics.find(t=>t.id===new URLSearchParams(location.search).get('topic')),session=null,pending=null;
  function show(id){for(const name of ['catalog','setup','quiz','results'])$(name).hidden=name!==id;window.scrollTo(0,0);}
  function saveSession(){if(session)localStorage.setItem(C.SESSION_KEY,JSON.stringify(session));else localStorage.removeItem(C.SESSION_KEY);}
  function catalog(){
    const s=C.load(localStorage);
    $('topic-list').innerHTML=C.topics.map(t=>{
      const pool=rows.filter(q=>C.matches(q,t)),seen=pool.filter(q=>s.attempts[q.id]).length,w=pool.filter(q=>C.weak(q,s)).length;
      return `<a class="panel link-card" href="?topic=${t.id}"><span class="eyebrow">${t.quota?'30〜45分の入口':'1項目 / 最大10問'}</span><h3>${escape(t.label)}</h3><p>${escape(t.note)}</p><p class="stats">収録${pool.length}問 · 経験${seen}問 · 弱点${w}問</p></a>`;
    }).join('');
    $('resume').hidden=!session;
    if(session)$('resume-copy').textContent=`${C.topics.find(t=>t.id===session.topic)?.label} · ${session.index+1}/${session.ids.length}問目`;
    show('catalog');
  }
  function setup(){
    $('topic-title').textContent=topic.label;$('topic-note').textContent=topic.note;
    const pool=rows.filter(q=>C.matches(q,topic)),s=C.load(localStorage);
    $('topic-stats').textContent=`収録${pool.length}問 / 未出${pool.filter(q=>!s.attempts[q.id]).length}問 / 弱点${pool.filter(q=>C.weak(q,s)).length}問`;
    show('setup');
  }
  function render(){
    const q=byId.get(session.ids[session.index]);if(!q)return finish();
    $('counter').textContent=`${session.index+1} / ${session.ids.length}`;$('progress').max=session.ids.length;$('progress').value=session.index;
    $('question-label').textContent=topic.label+' / '+q.concept;$('question').textContent=q.question;
    $('choices').innerHTML=q.choices ? q.choices.map((text,i)=>`<button type="button" data-answer="${i}">${'ABCD'[i]}　${escape(text)}</button>`).join('') : '';
    $('written-form').hidden=Boolean(q.choices);$('written').value='';$('written').disabled=false;
    $('written-form').querySelector('button').disabled=false;
    $('feedback').hidden=true;$('review').hidden=true;$('save-error').textContent='';
    $('note').value=session.note ?? C.load(localStorage).notes[q.id] ?? '';pending=null;
    $('choices').querySelectorAll('button').forEach(b=>b.onclick=()=>answer(Number(b.dataset.answer)));
    show('quiz');
    if(session.pending){pending=session.pending;feedback(q);}
  }
  function answer(value){
    if(pending || !session)return;
    const q=byId.get(session.ids[session.index]);if(q.category==='practical'&&!String(value).trim())return;
    pending={value,correct:C.grade(q,value)};session.pending=pending;saveSession();feedback(q);
  }
  function feedback(q){
    $('choices').querySelectorAll('button').forEach(b=>{b.disabled=true;b.classList.toggle('selected',Number(b.dataset.answer)===pending.value);});
    $('written').value=q.category==='practical'?pending.value:'';$('written').disabled=true;$('written-form').querySelector('button').disabled=true;
    $('feedback').hidden=false;$('feedback').className='answer'+(pending.correct?'':' ng');
    $('verdict').textContent=(pending.correct?'○ 正解':'× 正解：'+(q.expected||q.choices[q.answer]));
    $('explanation').textContent=q.explanation;
    $('choice-reasons').innerHTML=q.choices?`<ol>${q.choices.map((v,i)=>`<li><b>${'ABCD'[i]} ${escape(v)}${i===q.answer?'（正解）':''}</b><br>${escape(q.choiceNotes[i])}</li>`).join('')}</ol>`:`<p>模範：${escape(q.expected)}</p>`;
    $('source').href=q.source.url;$('source').textContent=q.source.label;$('review').hidden=false;
  }
  function commit(confidence){
    if(!pending||!session)return;
    const q=byId.get(session.ids[session.index]);
    try { C.record(localStorage,q,pending.correct,confidence,$('note').value); }
    catch { $('save-error').textContent='記録を保存できませんでした。ブラウザの保存設定を確認して再度押してください。';return; }
    session.answers.push({id:q.id,...pending,confidence});delete session.pending;delete session.note;pending=null;
    if(session.index===session.ids.length-1)return finish();
    session.index++;saveSession();render();
  }
  function finish(){
    const answers=session?.answers||[],correct=answers.filter(a=>a.correct).length;
    $('result-title').textContent=topic.label;$('result-score').textContent=`${correct}/${answers.length} 正解`;
    $('result-confidence').textContent=`○ ${answers.filter(a=>a.confidence==='ok').length} / △ ${answers.filter(a=>a.confidence==='unsure').length} / × ${answers.filter(a=>a.confidence==='miss').length}`;
    $('result-review').innerHTML=answers.filter(a=>!a.correct||a.confidence!=='ok').map(a=>{
      const q=byId.get(a.id);return `<article class="panel"><b>${a.correct?'△':'×'} ${escape(q.concept)}</b><p>${escape(q.explanation)}</p></article>`;
    }).join('');
    $('retry').href='?topic='+topic.id;session=null;saveSession();show('results');
  }
  $('start').onclick=()=>{
    const selected=C.select(rows,topic,C.load(localStorage),$('mode').value);
    if(!selected.length){$('empty').textContent='この条件の問題はありません。弱点・未出を優先に切り替えてください。';return;}
    // Preserve interrupted topic work; original app's own session is never touched.
    if(session){$('empty').textContent='一覧から途中の項目別テストを再開するか、終了してから開始してください。';return;}
    session={topic:topic.id,ids:selected.map(q=>q.id),index:0,answers:[]};saveSession();render();
  };
  $('written-form').onsubmit=e=>{e.preventDefault();answer($('written').value);};
  document.querySelectorAll('[data-confidence]').forEach(b=>b.onclick=()=>commit(b.dataset.confidence));
  $('note').oninput=()=>{if(session){session.note=$('note').value;saveSession();}};
  $('pause').onclick=()=>{if(session.pending)session.pending=pending;saveSession();catalog();};
  $('resume-button').onclick=()=>{topic=C.topics.find(t=>t.id===session.topic);render();};
  $('discard-button').onclick=()=>{session=null;pending=null;saveSession();catalog();};
  try{session=JSON.parse(localStorage.getItem(C.SESSION_KEY));}catch{}
  if(session&&(!C.topics.some(t=>t.id===session.topic)||!Array.isArray(session.ids)||!session.ids.length||session.ids.some(id=>!byId.has(id))||!Number.isInteger(session.index)||session.index<0||session.index>=session.ids.length||!Array.isArray(session.answers)))session=null;
  if(topic)setup();else catalog();
})();
