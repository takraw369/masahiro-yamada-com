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
      return `<a class="panel link-card" href="?topic=${t.id}"><span class="eyebrow">${t.id==='law-all'?'10・20・全70問を選択':t.quota?'30〜45分の入口':'1項目 / 最大10問'}</span><h3>${escape(t.label)}</h3><p>${escape(t.note)}</p><p class="stats">収録${pool.length}問 · 経験${seen}問 · 弱点${w}問</p></a>`;
    }).join('');
    $('resume').hidden=!session;
    if(session)$('resume-copy').textContent=`${C.topics.find(t=>t.id===session.topic)?.label} · ${session.index+1}/${session.ids.length}問目`;
    show('catalog');
  }
  function setup(){
    $('topic-title').textContent=topic.label;$('topic-note').textContent=topic.note;
    $('law-count-control').hidden=topic.id!=='law-all';
    $('question-count').value='10';
    const pool=rows.filter(q=>C.matches(q,topic)),s=C.load(localStorage);
    $('topic-stats').textContent=`収録${pool.length}問 / 未出${pool.filter(q=>!s.attempts[q.id]).length}問 / 弱点${pool.filter(q=>C.weak(q,s)).length}問`;
    $('setup-resume').hidden=!session;
    if(session){
      const name=C.topics.find(t=>t.id===session.topic)?.label||'前のテスト';
      $('setup-resume-copy').textContent=`${name} / ${session.index+1}問目（全${session.ids.length}問）を途中保存しています。`;
      $('start').textContent='新しく始める（前の途中テストを終了）';
    }else{
      $('start').textContent='テストを始める';
    }
    $('empty').textContent='';
    show('setup');
  }
  function render(){
    const q=byId.get(session.ids[session.index]);if(!q)return finish();
    $('counter').textContent=`${session.index+1} / ${session.ids.length}`;$('progress').max=session.ids.length;$('progress').value=session.index;
    $('question-label').textContent=topic.label+' / '+q.concept;$('question').textContent=q.question;
    $('choices-help').hidden=!q.choices;
    $('submit-choice').hidden=!q.choices;
    $('choice-status').hidden=!q.choices;
    // Marking is a compact elimination memo at the LEFT; tap the full text to choose ONE final answer.
    $('choices').innerHTML=q.choices ? q.choices.map((text,i)=>
      `<div class="choice-row" data-choice-row="${i}">`+
      `<div class="choice-mark-actions" role="group" aria-label="選択肢${'ABCD'[i]}に印を付ける"><button type="button" data-mark="circle" data-index="${i}" aria-pressed="false" aria-label="選択肢${'ABCD'[i]}に○を付けて回答に選ぶ">○</button><button type="button" data-mark="cross" data-index="${i}" aria-pressed="false" aria-label="選択肢${'ABCD'[i]}を除外する（×）">×</button></div>`+
      `<button type="button" class="choice-pick" data-answer="${i}" aria-pressed="false" aria-label="選択肢${'ABCD'[i]} ${escape(text)}を回答に選ぶ"><span class="choice-letter">${'ABCD'[i]}</span><span class="choice-copy">${escape(text)}</span><span class="selected-indicator" aria-hidden="true">✓</span></button></div>`).join('') : '';
    $('choices').querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>choose(Number(b.dataset.answer)));
    $('choices').querySelectorAll('[data-mark]').forEach(b=>b.onclick=()=>markChoice(Number(b.dataset.index),b.dataset.mark));
    refreshChoiceUI();
    $('written-form').hidden=Boolean(q.choices);$('written').value='';$('written').disabled=false;
    $('written-form').querySelector('button').disabled=false;
    $('feedback').hidden=true;$('review').hidden=true;$('save-error').textContent='';
    $('note').value=session.note ?? C.load(localStorage).notes[q.id] ?? '';pending=null;
    show('quiz');
    if(session.pending){pending=session.pending;feedback(q);}
  }
  function refreshChoiceUI(){
    if(!session)return;
    const selected=Number.isInteger(session.selectedChoice)?session.selectedChoice:null;
    const marks=session.choiceMarks||{};
    $('choices').querySelectorAll('[data-answer]').forEach(b=>{
      const isSelected=Number(b.dataset.answer)===selected;
      b.classList.toggle('selected',isSelected);b.setAttribute('aria-pressed',String(isSelected));
    });
    $('choices').querySelectorAll('[data-mark]').forEach(b=>{
      const marked=marks[b.dataset.index]===b.dataset.mark;
      b.setAttribute('aria-pressed',String(marked));
    });
    $('choices').querySelectorAll('[data-choice-row]').forEach(row=>{
      const mark=marks[row.dataset.choiceRow];
      row.classList.toggle('has-mark-circle',mark==='circle');
      row.classList.toggle('has-mark-cross',mark==='cross');
    });
    $('submit-choice').disabled=selected===null||Boolean(pending);
    $('choice-status').textContent=selected===null?'答えは未選択です。選択肢の文章をタップすると選べます。':`選択肢${'ABCD'[selected]}を選択中。「答え合わせ」で確定できます。`;
  }
  function choose(index){
    if(pending||!session)return;
    session.selectedChoice=index;
    // An excluded answer can be reconsidered without leaving crossed-out selected text.
    if(session.choiceMarks?.[index]==='cross')delete session.choiceMarks[index];
    saveSession();refreshChoiceUI();
  }
  function markChoice(index,kind){
    if(pending||!session)return;
    session.choiceMarks=session.choiceMarks||{};
    const removing=session.choiceMarks[index]===kind;
    if(removing)delete session.choiceMarks[index];
    else session.choiceMarks[index]=kind;
    if(kind==='circle'){
      // A circle is the learner's positive answer, not merely an unrelated note.
      // One circle alone must enable "答え合わせ", even if the answer text was never tapped.
      if(removing){
        if(session.selectedChoice===index)delete session.selectedChoice;
      }else session.selectedChoice=index;
    }else if(kind==='cross' && session.selectedChoice===index){
      delete session.selectedChoice;
    }
    saveSession();refreshChoiceUI();
  }
  function answer(value){
    if(pending || !session)return;
    const q=byId.get(session.ids[session.index]);
    if(q.category==='practical'&&!String(value).trim())return;
    if(q.choices&&!Number.isInteger(value))return;
    pending={value,correct:C.grade(q,value),choiceMarks:{...(session.choiceMarks||{})}};session.pending=pending;saveSession();feedback(q);
  }
  function feedback(q){
    $('choices').querySelectorAll('[data-answer]').forEach(b=>{b.disabled=true;b.classList.toggle('selected',Number(b.dataset.answer)===pending.value);b.setAttribute('aria-pressed',String(Number(b.dataset.answer)===pending.value));});
    $('choices').querySelectorAll('[data-mark]').forEach(b=>b.disabled=true);
    $('submit-choice').hidden=true;
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
    session.answers.push({id:q.id,...pending,confidence});delete session.pending;delete session.note;delete session.selectedChoice;delete session.choiceMarks;pending=null;
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
    const limit=topic.id==='law-all'?$('question-count').value:10;
    const selected=C.select(rows,topic,C.load(localStorage),$('mode').value,Date.now(),limit);
    if(!selected.length){$('empty').textContent='この条件の問題はありません。弱点・未出を優先に切り替えてください。';return;}
    // The explicitly labelled "new test" button replaces only the interrupted
    // topic-test session; already recorded questions remain in the study history.
    pending=null;
    session={topic:topic.id,ids:selected.map(q=>q.id),index:0,answers:[]};
    saveSession();render();
  };
  $('submit-choice').onclick=()=>{if(session&&Number.isInteger(session.selectedChoice))answer(session.selectedChoice);};
  $('setup-resume-button').onclick=()=>{if(!session)return;topic=C.topics.find(t=>t.id===session.topic);render();};
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
