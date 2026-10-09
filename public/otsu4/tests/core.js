/* 問題文・解説の正本は /otsu4/questions.js。ここは出題範囲だけを定義する。 */
(() => {
  'use strict';
  const STATE_KEY = 'otsu4-study-state-v1';
  const SESSION_KEY = 'otsu4-topic-test-session-v1';
  const topics = [
    {id:'lecture-marks', label:'★ 講習で線を引いた箇所', marked:true, note:'赤線・丸・星印を優先。写真のページを確認し、誤答・△を繰り返す。'},
    { id:'jikahou-focus', label:'10/9〜13 自火報の構成＋設置基準10問', ids:[
      'l01','l02','l03','l05','l06','l07','l08','l09','l10','l11','l12','l13','l14','l15','l16','l17','l18','l19','l24',
      's01','s02','s03','s04','s05','s06','s07','s08','s09','s10','s11','s12','s13','s14','s15','s16','s17','s18','s19','s20',
      'p01','p02','p03','p04','p05','p06','p07'
    ],quota:{'law-class':4,structure:5,practical:1},
      note:'10/9講習は自火報の構成と設置基準。用途・面積・警戒区域等の法令4問＋感知器・受信機・信号経路など構造機能5問＋名称記述1問。既存問題と学習履歴を共有。' },
    { id:'jikahou-install', label:'自火報の設置基準｜集中10問', ids:[
      'l01','l02','l03','l05','l08','l09','l10','l11','l12','l13','l14','l15','l16','l17','l18','l19','l24'
    ],note:'講習の設置基準を深掘り。防火対象物の用途・面積と例外、地階・無窓階・駐車場・11階以上、警戒区域、区画の考え方。既存法令問題の△・×・未出を優先。' },
    { id:'law-all', label:'法令総合（別表第1とは別）', quota:{'law-common':5,'law-class':5}, note:'10問・20問・全70問を選択。消防組織・防火管理・点検報告・警戒区域などを確認。' },
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
  // Keep the original signature intact: the optional sixth argument sets the law-only session size.
  function select(rows,topic,state,mode='smart',now=Date.now(),limit=10) {
    const pool=rows.filter(q=>matches(q,topic));
    const law=topic.id==='law-all';
    const entireLawPool=law && (limit==='all' || Number(limit)===pool.length);
    const target=law ? (entireLawPool ? pool.length : Number(limit)===20 ? 20 : 10) : 10;
    // "All 70" means all laws, even when the preference is weak / unseen.
    const eligible=entireLawPool ? pool : mode==='weak' ? pool.filter(q=>weak(q,state)) : mode==='unseen' ? pool.filter(q=>!(state.attempts[q.id]||0)) : pool;
    const ranked=[...eligible].sort((a,b)=>priority(b,state,now)-priority(a,state,now));
    const usedIds=new Set(),usedConcepts=new Set(),picked=[];
    const take=(items,count)=>{
      let n=0;
      for(const q of items) {
        if(n>=count)break;
        if(usedIds.has(q.id) || usedConcepts.has(q.concept))continue;
        usedIds.add(q.id);usedConcepts.add(q.concept);picked.push(q);n++;
      }
    };
    if(law && !entireLawPool) {
      const each=target/2;
      take(ranked.filter(q=>q.category==='law-common'),each);
      take(ranked.filter(q=>q.category==='law-class'),each);
      if(picked.length<target)take(ranked,target-picked.length);
    } else if (law && entireLawPool) {
      take(ranked,target);
    } else if(topic.quota) {
      for(const [category,n] of Object.entries(topic.quota))take(ranked.filter(q=>q.category===category),n);
    } else take(ranked,10);
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
