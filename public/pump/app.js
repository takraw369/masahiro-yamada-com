(() => {
  const STORE_KEY = 'masa-pump-quest-v1';
  const TARGET = '2026-10-09';

  const days = [
    {
      date:'2026-09-29', label:'9/29', title:'胸 × 肩 × 三頭', zone:'UPPER', note:'最初の一撃。肩幅と胸の立体感を作る。',
      exercises:[
        {id:'pushup',name:'プッシュアップ',sets:4,reps:'10–15回',rest:45,motion:'push',gear:'自重',cue:'胸を床へ。肘を開きすぎず、最後に胸を寄せる意識。'},
        {id:'lateral',name:'ペットボトル・サイドレイズ',sets:4,reps:'15–20回',rest:35,motion:'lateral',gear:'ボトル',cue:'肩をすくめず、肘から横へ。反動は小さく。'},
        {id:'pike',name:'パイク・プッシュアップ',sets:3,reps:'8–12回',rest:50,motion:'push',gear:'自重',cue:'お尻を高く。頭を斜め前へ下ろして肩に乗せる。'},
        {id:'dip',name:'チェア・ディップス',sets:3,reps:'10–15回',rest:45,motion:'dip',gear:'椅子',cue:'肩をすくめず、肘を後ろへ。痛みが出る深さまで下げない。'}
      ]
    },
    {
      date:'2026-09-30', label:'9/30', title:'背中 × 二頭 × 腹', zone:'V-SHAPE', note:'背中を広げて、正面からも逆三角形を強くする。',
      exercises:[
        {id:'row',name:'リュック・ベントロー',sets:4,reps:'12–15回',rest:50,motion:'row',gear:'リュック',cue:'胸を少し張り、肘を腰へ引く。肩甲骨を最後に寄せる。'},
        {id:'snow',name:'リバース・スノーエンジェル',sets:3,reps:'12–15回',rest:35,motion:'row',gear:'自重',cue:'うつ伏せで腕を弧のように動かす。首は長く保つ。'},
        {id:'curl',name:'リュック・カール',sets:4,reps:'12–15回',rest:40,motion:'curl',gear:'リュック',cue:'肘を体側で固定。上で1秒止めて二頭を縮める。'},
        {id:'plank',name:'プランク',sets:3,reps:'40–50秒',rest:35,motion:'plank',gear:'自重',cue:'肋骨を締め、腰を反らさず一直線。'}
      ]
    },
    {
      date:'2026-10-01', label:'10/1', title:'脚 × 肩', zone:'BASE', note:'脚を刺激して全身を起こし、肩幅も上積み。',
      exercises:[
        {id:'squat',name:'スクワット',sets:4,reps:'15回',rest:50,motion:'squat',gear:'自重',cue:'膝とつま先を同じ方向へ。床を押して立つ。'},
        {id:'split',name:'スプリットスクワット',sets:3,reps:'左右10回',rest:45,motion:'squat',gear:'自重',cue:'前脚の足裏全体で押す。上体は長く。'},
        {id:'lateral',name:'サイドレイズ',sets:4,reps:'15–20回',rest:35,motion:'lateral',gear:'ボトル',cue:'肩の高さまで。軽めで狙った筋肉を外さない。'},
        {id:'pike',name:'パイク・プッシュアップ',sets:3,reps:'8–12回',rest:50,motion:'push',gear:'自重',cue:'肩に体重を乗せ、可動域は痛みのない範囲で。'}
      ]
    },
    {
      date:'2026-10-02', label:'10/2', title:'胸 × 背中', zone:'TORSO', note:'前後から厚みを足す。今日は大きい筋肉を交互に。',
      exercises:[
        {id:'tempo-push',name:'3秒ネガティブ腕立て',sets:4,reps:'8–12回',rest:50,motion:'push',gear:'自重',cue:'3秒で下ろし、普通の速さで押す。フォーム優先。'},
        {id:'row',name:'リュック・ベントロー',sets:4,reps:'12–15回',rest:50,motion:'row',gear:'リュック',cue:'背中で引く。腰を丸めない。'},
        {id:'wide-push',name:'ワイド・プッシュアップ',sets:3,reps:'10–15回',rest:45,motion:'push',gear:'自重',cue:'手幅は少し広め。肩前に痛みがあれば通常幅へ。'},
        {id:'snow',name:'リバース・スノーエンジェル',sets:3,reps:'15回',rest:35,motion:'row',gear:'自重',cue:'小さくても背中に入る範囲で丁寧に。'}
      ]
    },
    {
      date:'2026-10-03', label:'10/3', title:'回復 × 腹', zone:'RESET', note:'今日は強くする日ではなく、明日の張りを取り戻す日。',
      exercises:[
        {id:'walk',name:'早歩き',sets:2,reps:'10分',rest:20,motion:'squat',gear:'なし',cue:'会話できる強度。疲労を残さない。'},
        {id:'deadbug',name:'デッドバグ',sets:3,reps:'左右8–10回',rest:35,motion:'core',gear:'自重',cue:'腰を床へ近づけたまま、対角の手脚をゆっくり伸ばす。'},
        {id:'side-plank',name:'サイドプランク',sets:3,reps:'左右30秒',rest:30,motion:'plank',gear:'自重',cue:'頭から足まで一直線。腰が落ちる前に終了。'}
      ]
    },
    {
      date:'2026-10-04', label:'10/4', title:'肩 × 腕', zone:'FRAME', note:'プール映えの即効ゾーン。肩の丸みと腕の存在感。',
      exercises:[
        {id:'lateral',name:'サイドレイズ',sets:5,reps:'15–20回',rest:35,motion:'lateral',gear:'ボトル',cue:'軽くてもOK。肩の横が熱くなる位置を探す。'},
        {id:'pike',name:'パイク・プッシュアップ',sets:4,reps:'8–12回',rest:50,motion:'push',gear:'自重',cue:'頭を手より少し前へ。肩に乗せる。'},
        {id:'curl',name:'リュック・カール',sets:4,reps:'12–15回',rest:40,motion:'curl',gear:'リュック',cue:'反動より収縮。最後の数回を丁寧に。'},
        {id:'dip',name:'チェア・ディップス',sets:4,reps:'10–15回',rest:45,motion:'dip',gear:'椅子',cue:'三頭で押す。肩の前に違和感があればナロー腕立てへ。'}
      ]
    },
    {
      date:'2026-10-05', label:'10/5', title:'背中 × 胸', zone:'V-SHAPE', note:'逆三角形をもう一段。大きく見える土台を作る。',
      exercises:[
        {id:'row',name:'リュック・ベントロー',sets:5,reps:'12–15回',rest:50,motion:'row',gear:'リュック',cue:'肘を腰へ。上で肩甲骨を寄せて1秒。'},
        {id:'pushup',name:'プッシュアップ',sets:5,reps:'10–15回',rest:50,motion:'push',gear:'自重',cue:'胸をしっかり下ろし、床を遠ざける。'},
        {id:'snow',name:'リバース・スノーエンジェル',sets:3,reps:'15回',rest:35,motion:'row',gear:'自重',cue:'肩を耳から遠ざけ、背中を長く使う。'}
      ]
    },
    {
      date:'2026-10-06', label:'10/6', title:'脚 × 腹 × 肩', zone:'BASE', note:'全身を整えつつ、見た目の主役は肩に残す。',
      exercises:[
        {id:'squat',name:'スクワット',sets:4,reps:'15回',rest:50,motion:'squat',gear:'自重',cue:'足裏全体で床を押す。'},
        {id:'split',name:'スプリットスクワット',sets:3,reps:'左右10回',rest:45,motion:'squat',gear:'自重',cue:'前脚に体重を乗せ、ぶれない範囲で。'},
        {id:'lateral',name:'サイドレイズ',sets:4,reps:'15回',rest:35,motion:'lateral',gear:'ボトル',cue:'今日も軽めで肩の横へ正確に。'},
        {id:'plank',name:'プランク',sets:3,reps:'45秒',rest:35,motion:'plank',gear:'自重',cue:'お尻を締め、呼吸を止めない。'}
      ]
    },
    {
      date:'2026-10-07', label:'10/7', title:'上半身 FINAL', zone:'UPPER', note:'最後のしっかり刺激。明日から疲労を抜く。',
      exercises:[
        {id:'pushup',name:'プッシュアップ',sets:4,reps:'10–15回',rest:45,motion:'push',gear:'自重',cue:'限界の1〜2回手前で止めてもOK。'},
        {id:'row',name:'リュック・ベントロー',sets:4,reps:'12–15回',rest:45,motion:'row',gear:'リュック',cue:'背中を広く使う。'},
        {id:'lateral',name:'サイドレイズ',sets:4,reps:'15–20回',rest:35,motion:'lateral',gear:'ボトル',cue:'反動よりパンプ。'},
        {id:'curl',name:'リュック・カール',sets:4,reps:'12–15回',rest:35,motion:'curl',gear:'リュック',cue:'上で止める。'},
        {id:'close-push',name:'ナロー・プッシュアップ',sets:3,reps:'8–12回',rest:40,motion:'push',gear:'自重',cue:'肘を体側へ。三頭に集める。'}
      ]
    },
    {
      date:'2026-10-08', label:'10/8', title:'PRIMER', zone:'LIGHT', note:'軽く動いて終える。筋肉痛を作らず、明日に残す。',
      exercises:[
        {id:'pushup',name:'軽めプッシュアップ',sets:2,reps:'8–10回',rest:35,motion:'push',gear:'自重',cue:'余裕を残して終える。'},
        {id:'row',name:'軽めリュック・ロー',sets:2,reps:'10回',rest:35,motion:'row',gear:'リュック',cue:'軽い負荷で動きを確認。'},
        {id:'lateral',name:'軽めサイドレイズ',sets:2,reps:'12回',rest:30,motion:'lateral',gear:'ボトル',cue:'肩が少し温まれば十分。'},
        {id:'squat',name:'軽めスクワット',sets:2,reps:'10回',rest:30,motion:'squat',gear:'自重',cue:'深追いしない。'}
      ]
    },
    {
      date:'2026-10-09', label:'10/9', title:'POOL PUMP', zone:'SHOWTIME', note:'今日は鍛える日じゃない。10〜15分で張らせて終える。',
      exercises:[
        {id:'pushup',name:'パンプ・プッシュアップ',sets:2,reps:'12–20回',rest:25,motion:'push',gear:'自重',cue:'限界まで行かず、胸に血流が集まったら止める。'},
        {id:'row',name:'パンプ・ロー',sets:2,reps:'15回',rest:25,motion:'row',gear:'リュック',cue:'軽めでテンポ良く。背中を広げる。'},
        {id:'lateral',name:'パンプ・サイドレイズ',sets:3,reps:'15–20回',rest:20,motion:'lateral',gear:'ボトル',cue:'肩が丸く見える程度で終了。'},
        {id:'curl',name:'パンプ・カール',sets:2,reps:'15–20回',rest:20,motion:'curl',gear:'リュック',cue:'軽めで連続。肘は固定。'},
        {id:'close-push',name:'ナロー腕立て',sets:2,reps:'10–15回',rest:20,motion:'push',gear:'自重',cue:'三頭に軽く血流を入れて終える。'}
      ]
    }
  ];

  const byId = (id) => document.getElementById(id);
  const state = loadState();
  let selectedDay = resolveInitialDay();
  let combo = 1;
  let timerId = null;
  let timerLeft = 0;

  function loadState(){
    try{
      return Object.assign({xp:0,sets:{},days:{},sound:true},JSON.parse(localStorage.getItem(STORE_KEY)||'{}'));
    }catch(_){return {xp:0,sets:{},days:{},sound:true};}
  }
  function save(){ localStorage.setItem(STORE_KEY,JSON.stringify(state)); }
  function localDateKey(){
    const d = new Date();
    const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`;
  }
  function resolveInitialDay(){
    const key=localDateKey();
    return days.find(d=>d.date===key) || (key<days[0].date?days[0]:days[days.length-1]);
  }
  function totalSets(day){ return day.exercises.reduce((n,e)=>n+e.sets,0); }
  function doneFor(day,ex){ return Math.min(ex.sets, Number(state.sets?.[day.date]?.[ex.id]||0)); }
  function doneSets(day){ return day.exercises.reduce((n,e)=>n+doneFor(day,e),0); }
  function dayComplete(day){ return doneSets(day)>=totalSets(day); }
  function estimateMinutes(day){
    const work=day.exercises.reduce((n,e)=>n+e.sets*35+Math.max(0,e.sets-1)*e.rest,0);
    return Math.max(8,Math.round(work/60));
  }

  function renderAll(){
    renderCountdown(); renderHud(); renderSelectedDay(); renderCalendar();
    byId('sound-toggle').textContent=state.sound?'🔊':'🔇';
  }
  function renderCountdown(){
    const now=new Date(); now.setHours(12,0,0,0);
    const target=new Date('2026-10-09T12:00:00');
    const left=Math.max(0,Math.ceil((target-now)/86400000));
    byId('days-left').textContent=String(left);
    const progress=Math.min(1,Math.max(0,(10-left)/10));
    const length=320.44;
    byId('ring-progress').style.strokeDashoffset=String(length-(length*progress));
  }
  function renderHud(){
    const level=Math.floor(state.xp/100)+1;
    const inLevel=state.xp%100;
    byId('level').textContent=String(level);
    byId('xp-copy').textContent=`${inLevel} / 100 XP`;
    byId('xp-fill').style.width=`${inLevel}%`;
    const completed=days.filter(d=>state.days[d.date]).length;
    byId('streak-copy').textContent=`🔥 ${completed} DAY`;
  }
  function renderSelectedDay(){
    byId('today-focus').textContent=`${selectedDay.label} // ${selectedDay.title} — ${selectedDay.note}`;
    byId('today-sets').textContent=String(totalSets(selectedDay));
    byId('today-minutes').textContent=`${estimateMinutes(selectedDay)}m`;
    byId('today-xp').textContent=`${totalSets(selectedDay)*12}+`;
    byId('today-zone').textContent=selectedDay.zone;
    byId('workout-title').textContent=`${selectedDay.label}  ${selectedDay.title}`;
    byId('total-count').textContent=String(totalSets(selectedDay));
    renderExercises();
    updateQuestProgress();
  }
  function figure(motion){
    const svg=(a,b,extra='')=>`<svg class="motion-svg motion-svg-${motion}" viewBox="0 0 160 110" aria-hidden="true" focusable="false">
      <g class="pose pose-a">${a}</g>
      <g class="pose pose-b">${b}</g>
      ${extra}
    </svg>`;
    const dot=(x,y)=>`<circle class="skin-fill" cx="${x}" cy="${y}" r="9"/>`;
    const line=(x1,y1,x2,y2,cls='body-line')=>`<line class="${cls}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    const ground='<line class="ground-line" x1="18" y1="96" x2="142" y2="96"/>';
    if(motion==='push'){
      const a=dot(126,43)+line(116,49,72,57)+line(72,57,33,78)+line(104,51,108,91)+line(89,54,92,91);
      const b=dot(126,67)+line(116,69,73,72)+line(73,72,34,84)+line(104,69,113,91)+line(90,71,96,91);
      return svg(a,b,ground);
    }
    if(motion==='row'){
      const a=dot(101,25)+line(96,34,72,65)+line(72,65,54,94)+line(72,65,83,94)+line(89,42,112,72)+line(83,47,104,77)+line(105,77,121,77,'load-line');
      const b=dot(101,25)+line(96,34,72,65)+line(72,65,54,94)+line(72,65,83,94)+line(89,42,82,59)+line(83,47,77,62)+line(76,62,92,62,'load-line');
      return svg(a,b,ground);
    }
    if(motion==='lateral'){
      const a=dot(80,20)+line(80,31,80,66)+line(80,66,64,95)+line(80,66,96,95)+line(78,39,57,72)+line(82,39,103,72)+line(51,76,63,76,'load-line')+line(97,76,109,76,'load-line');
      const b=dot(80,20)+line(80,31,80,66)+line(80,66,64,95)+line(80,66,96,95)+line(78,39,34,42)+line(82,39,126,42)+line(27,42,39,42,'load-line')+line(121,42,133,42,'load-line');
      return svg(a,b,ground);
    }
    if(motion==='curl'){
      const a=dot(80,20)+line(80,31,80,66)+line(80,66,64,95)+line(80,66,96,95)+line(76,40,60,73)+line(84,40,100,73)+line(54,77,66,77,'load-line')+line(94,77,106,77,'load-line');
      const b=dot(80,20)+line(80,31,80,66)+line(80,66,64,95)+line(80,66,96,95)+line(76,40,62,55)+line(62,55,72,39)+line(84,40,98,55)+line(98,55,88,39)+line(67,36,77,36,'load-line')+line(83,36,93,36,'load-line');
      return svg(a,b,ground);
    }
    if(motion==='squat'){
      const a=dot(80,19)+line(80,30,80,62)+line(80,62,61,94)+line(80,62,99,94)+line(78,40,58,60)+line(82,40,102,60);
      const b=dot(80,37)+line(80,47,80,68)+line(80,68,55,76)+line(55,76,42,95)+line(80,68,105,76)+line(105,76,118,95)+line(78,50,58,66)+line(82,50,102,66);
      return svg(a,b,ground);
    }
    if(motion==='plank'){
      const a=dot(126,58)+line(116,61,75,64)+line(75,64,34,78)+line(104,62,109,91)+line(75,64,80,91);
      const b=dot(126,61)+line(116,64,75,66)+line(75,66,34,80)+line(104,64,109,91)+line(75,66,80,91);
      return svg(a,b,ground);
    }
    if(motion==='dip'){
      const bench='<line class="bench-line" x1="35" y1="54" x2="78" y2="54"/><line class="bench-line" x1="42" y1="54" x2="42" y2="92"/>';
      const a=dot(92,28)+line(88,38,86,66)+line(86,66,112,91)+line(86,66,67,91)+line(84,43,69,55)+line(69,55,60,75);
      const b=dot(92,45)+line(88,54,86,76)+line(86,76,112,91)+line(86,76,67,91)+line(84,57,70,62)+line(70,62,60,75);
      return svg(a,b,bench+ground);
    }
    if(motion==='core'){
      const a=dot(120,65)+line(110,69,72,74)+line(72,74,35,85)+line(82,72,99,48)+line(72,74,55,48);
      const b=dot(111,53)+line(102,59,78,70)+line(78,70,55,88)+line(86,66,104,70)+line(78,70,63,58);
      return svg(a,b,ground);
    }
    return svg(dot(80,20)+line(80,31,80,66)+line(80,66,64,95)+line(80,66,96,95),dot(80,20)+line(80,31,80,66)+line(80,66,64,95)+line(80,66,96,95),ground);
  }
  function renderExercises(){
    const list=byId('exercise-list');
    list.innerHTML=selectedDay.exercises.map((ex,index)=>{
      const done=doneFor(selectedDay,ex);
      const cleared=done>=ex.sets;
      const dots=Array.from({length:ex.sets},(_,i)=>`<i class="set-dot ${i<done?'on':''}"></i>`).join('');
      return `<article class="exercise-card ${cleared?'is-done':''}" data-index="${index}">
        <div class="motion-stage">${figure(ex.motion)}</div>
        <div class="exercise-info"><h3>${ex.name}</h3><div class="exercise-meta"><span>${ex.sets} SET</span><span>${ex.reps}</span><span>${ex.gear}</span></div><p>${ex.cue}</p></div>
        <div class="exercise-action"><div class="set-dots">${dots}</div><button class="set-btn" type="button" data-set="${index}" ${cleared?'disabled':''}>${cleared?'CLEAR ✓':`SET ${done+1}`}</button></div>
      </article>`;
    }).join('');
    list.querySelectorAll('.set-btn:not([disabled])').forEach(btn=>btn.addEventListener('click',()=>completeSet(Number(btn.dataset.set))));
  }
  function updateQuestProgress(){
    const done=doneSets(selectedDay), total=totalSets(selectedDay);
    byId('done-count').textContent=String(done);
    byId('quest-progress-fill').style.width=`${Math.round(done/total*100)}%`;
    const complete=done>=total;
    byId('finish-card').hidden=!complete;
    if(complete && !state.days[selectedDay.date]){
      state.days[selectedDay.date]=true; state.xp+=35; save(); renderHud(); renderCalendar();
      byId('finish-copy').textContent='QUEST CLEAR BONUS +35 XP。回復まで含めて今日の勝ち。';
      buzz([45,40,80]); beep(660,.08); setTimeout(()=>beep(880,.12),110);
    }
  }
  function completeSet(index){
    const ex=selectedDay.exercises[index];
    const bucket=state.sets[selectedDay.date]||(state.sets[selectedDay.date]={});
    const before=Number(bucket[ex.id]||0);
    if(before>=ex.sets)return;
    bucket[ex.id]=before+1;
    const previousLevel=Math.floor(state.xp/100)+1;
    const reward=12+Math.min(8,(combo-1)*2);
    state.xp+=reward; combo=Math.min(5,combo+1); save();
    byId('combo').textContent=`x${combo}`;
    buzz(35); beep(460+combo*55,.055);
    showToast(`+${reward} XP  //  SET CLEAR`);
    renderHud(); renderExercises(); updateQuestProgress();
    const card=document.querySelector(`[data-index="${index}"]`); if(card)card.classList.add('is-active');
    startRest(ex.rest,ex.name);
    const newLevel=Math.floor(state.xp/100)+1;
    if(newLevel>previousLevel) levelUp(newLevel);
  }
  function startRest(seconds,name){
    clearInterval(timerId); timerLeft=seconds;
    byId('timer-label').textContent=`REST // ${name}`; byId('timer-seconds').textContent=String(timerLeft); byId('timer-dock').hidden=false;
    timerId=setInterval(()=>{
      timerLeft-=1; byId('timer-seconds').textContent=String(timerLeft);
      if(timerLeft<=0){clearInterval(timerId); byId('timer-dock').hidden=true; beep(760,.1); buzz([25,40,25]); showToast('REST COMPLETE // NEXT SET');}
    },1000);
  }
  function skipTimer(){ clearInterval(timerId); byId('timer-dock').hidden=true; combo=Math.max(1,combo); }
  function renderCalendar(){
    const grid=byId('day-grid'),today=localDateKey();
    grid.innerHTML=days.map((d,i)=>{
      const done=dayComplete(d),current=d.date===today;
      return `<button class="day-card ${done?'is-done':''} ${current?'is-today':''}" type="button" data-day="${i}"><span class="date">${d.label}</span><span class="day-status">${done?'✓':current?'●':'○'}</span><strong>${d.title}</strong><p>${d.zone} // ${doneSets(d)}/${totalSets(d)} SET</p></button>`;
    }).join('');
    grid.querySelectorAll('.day-card').forEach(btn=>btn.addEventListener('click',()=>{
      selectedDay=days[Number(btn.dataset.day)]; renderSelectedDay();
      byId('workout-shell').hidden=false; byId('workout-shell').scrollIntoView({behavior:'smooth',block:'start'});
    }));
    const completed=days.filter(dayComplete).length;
    byId('calendar-progress').textContent=`${completed} / ${days.length}`;
  }
  function startQuest(){
    byId('workout-shell').hidden=false; combo=1; byId('combo').textContent='x1';
    renderSelectedDay();
    requestAnimationFrame(()=>{
      const first=document.querySelector('.exercise-card:not(.is-done)'); if(first)first.classList.add('is-active');
      byId('workout-shell').scrollIntoView({behavior:'smooth',block:'start'});
    });
    beep(420,.06); setTimeout(()=>beep(620,.08),80); buzz(30);
  }
  function showToast(message){
    const t=byId('toast'); t.textContent=message; t.classList.add('show'); clearTimeout(showToast.t); showToast.t=setTimeout(()=>t.classList.remove('show'),1500);
  }
  function levelUp(level){
    byId('level-up-number').textContent=String(level); byId('level-overlay').hidden=false; buzz([45,35,90]);
    setTimeout(()=>{byId('level-overlay').hidden=true;},1250);
  }
  function buzz(pattern){ if('vibrate' in navigator) navigator.vibrate(pattern); }
  function beep(freq=520,duration=.06){
    if(!state.sound)return;
    try{
      const AC=window.AudioContext||window.webkitAudioContext,ctx=new AC(),osc=ctx.createOscillator(),gain=ctx.createGain();
      osc.type='sine'; osc.frequency.value=freq; gain.gain.setValueAtTime(.0001,ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.07,ctx.currentTime+.01); gain.gain.exponentialRampToValueAtTime(.0001,ctx.currentTime+duration);
      osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+duration+.02);osc.onended=()=>ctx.close();
    }catch(_){}
  }

  byId('start-btn').addEventListener('click',startQuest);
  byId('calendar-jump').addEventListener('click',()=>byId('calendar-section').scrollIntoView({behavior:'smooth'}));
  byId('timer-skip').addEventListener('click',skipTimer);
  byId('sound-toggle').addEventListener('click',()=>{state.sound=!state.sound;save();renderHud();byId('sound-toggle').textContent=state.sound?'🔊':'🔇';showToast(state.sound?'SOUND ON':'SOUND OFF');});
  byId('finish-close').addEventListener('click',()=>{byId('finish-card').scrollIntoView({behavior:'smooth',block:'center'});showToast('RECOVERY QUEST UNLOCKED');});
  byId('level-overlay').addEventListener('click',()=>{byId('level-overlay').hidden=true;});

  renderAll();
})();
