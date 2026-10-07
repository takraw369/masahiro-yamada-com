/* 問題文・解説の正本は /otsu4/questions.js。ここは出題範囲だけを定義する。 */
(() => {
  'use strict';
  const STATE_KEY = 'otsu4-study-state-v1';
  const SESSION_KEY = 'otsu4-topic-test-session-v1';
  const topics = [
    {id:'lecture-marks', label:'★ 講習で線を引いた箇所', marked:true, note:'赤線・丸・星印を優先。写真のページを確認し、誤答・△を繰り返す。'},
    { id:'law-common', label:'共通法令', category:'law-common', note:'業務範囲・維持責任・点検と報告・複合用途' },
    { id:'law-class', label:'乙4法令・警戒区域', category:'law-class', note:'面積・一辺・見通し例外・第4類の対象' },
    { id:'electric', label:'電気基礎', category:'electric', note:'オームの法則・合成抵抗・電力・交流' },
    { id:'structure', label:'構造・機能・規格', category:'structure', note:'感知器・受信機・発信機・回線監視' },
    { id:'practical', label:'機器の記述鑑別', category:'practical', note:'名称を入力して自動判定。工具鑑別は既存トレーナーへ' },
    { id:'heat', label:'熱感知器', ids:['s01','s02','s03','s04','s05','s20'], note:'差動式・定温式・リーク孔・バイメタル' },
    { id:'smoke', label:'煙感知器と熱との比較', ids:['s06','s07','s17'], note:'光電式スポット型・分離型・熱との違い' },
    { id:'receiver', label:'受信機', ids:['s08','s09','s10'], note:'P型・R型・G型の役割' },
    { id:'signal', label:'発信機・断線・信号経路', ids:['s11','s12','s13','s18','s19'], note:'手動発報・終端抵抗・断線の切り分け' },
    { id:'alarm-power', label:'音響装置・電源・規格', ids:['s14','s15','s16'], note:'地区音響・停電時の電源・法令と規格の区別' },
    { id:'morning', label:'朝の診断10問', quota:{'law-common':2,'law-class':1,electric:2,structure:4,practical:1}, note:'共通2＋乙4法令1＋電気2＋構造4＋記述1' }
  ];
  const blank = () => ({attempts:{},correct:{},streak:{},wrong:{},notes:{},ratings:{},feedbackDrafts:{},feedbackEventIds:{},history:[]});
  function load(storage) {
    let state;
    try { state=JSON.parse(storage.getItem(STATE_KEY)); } catch {}
    if (!state || typeof state !== 'object' || Array.isArray(state)) state=blank();
    for (const name of Object.keys(blank()).filter(k=>k!=='history')) {
      if (!state[name] || typeof state[name]!=='object' || Array.isArray(state[name])) state[name]={};
    }
    if (!Array.isArray(state.history)) state.history=[];
    return state;
  }
  const weak = (q,s) => (s.wrong[q.id]||0)>0 || ['weak','repeat'].includes(s.ratings[q.id]);
  const subject = q => q.category.startsWith('law-') ? 'law' : q.category;
  const normalize = v => String(v||'').normalize('NFKC').replace(/[\s・。、,，.]/g,'').toLowerCase();
  const grade = (q,value) => q.category==='practical' ? q.accepted.some(v=>normalize(v)===normalize(value)) : Number(value)===q.answer;
  function matches(q,topic) { return topic.marked ? Boolean(q.lectureMarked) : topic.category ? q.category===topic.category : topic.ids ? topic.ids.includes(q.id) : Boolean(topic.quota?.[q.category]); }
  function priority(q,s,now) {
    let n=(weak(q,s)?120:0)+((s.attempts[q.id]||0)===0?100:0)+(q.officialSignal?25:0)+(q.lectureMarked?35:0);
    if ((s.streak[q.id]||0)>=2 && !weak(q,s)) n-=90;
    const last=[...s.history].reverse().find(r=>r.id===q.id);
    if(last && now-last.at<2*60*60*1000) n-=100;
    if(s.history.slice(-8).some(r=>r.concept===q.concept)) n-=55;
    return n;
  }
  function select(rows,topic,state,mode='smart',now=Date.now()) {
    const pool=rows.filter(q=>matches(q,topic));
    const eligible=mode==='weak' ? pool.filter(q=>weak(q,state)) : mode==='unseen' ? pool.filter(q=>!(state.attempts[q.id]||0)) : pool;
    const ranked=[...eligible].sort((a,b)=>priority(b,state,now)-priority(a,state,now));
    const used=new Set(),picked=[];
    const take=(items,count)=>{
      let n=0;
      for(const q of items) { if(n>=count) break; if(used.has(q.concept)) continue; used.add(q.concept);picked.push(q);n++; }
    };
    if(topic.quota) for(const [category,n] of Object.entries(topic.quota)) take(ranked.filter(q=>q.category===category),n);
    else take(ranked,10);
    return picked;
  }
  // Fresh read for every mutation: retain comments and all unrelated question records.
  function record(storage,q,correct,confidence,note,now=Date.now()) {
    const state=load(storage),id=q.id;
    state.attempts[id]=(state.attempts[id]||0)+1;
    state.correct[id]=(state.correct[id]||0)+Number(correct);
    state.streak[id]=correct ? (state.streak[id]||0)+1 : 0;
    if(!correct) state.wrong[id]=(state.wrong[id]||0)+1;
    else if(state.streak[id]>=2) state.wrong[id]=0;
    // Correct-but-uncertain remains a weakness in the existing adaptive engine.
    state.ratings[id]=confidence==='unsure' ? 'repeat' : !correct || confidence==='miss' ? 'weak' : state.streak[id]>=2 ? 'mastered' : '';
    if(note.trim()) state.notes[id]=note.trim().slice(0,300);
    state.history.push({id,concept:q.concept,subject:subject(q),correct,at:now});
    state.history=state.history.slice(-300);
    storage.setItem(STATE_KEY,JSON.stringify(state));
    return state;
  }
  window.OTSU4_TOPIC_TESTS={STATE_KEY,SESSION_KEY,topics,load,weak,subject,normalize,grade,matches,priority,select,record};
})();
