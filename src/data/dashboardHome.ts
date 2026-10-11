export const dashboardFlowSteps = [
  { no:'01', label:'CAPTURE', title:'残す', detail:'思いつき・体験・違和感', href:'/mind?action=capture' },
  { no:'02', label:'THINK', title:'意味をつくる', detail:'FLOW MIND / Intelligence', href:'/mind' },
  { no:'03', label:'SHIP', title:'外へ流す', detail:'Publishing Flow → X / LINE / ACE', href:'/dashboard/content-flow' },
  { no:'04', label:'LEARN', title:'反応を戻す', detail:'Evidence / Review', href:'/dashboard/evidence' },
];

export const dashboardOutputDoors = [
  {mark:'P',className:'publish',title:'Publishing Flow',detail:'今どこ？ → 次なに？を1本で決める',href:'/dashboard/content-flow'},
  {mark:'X',className:'',title:'X / Social',detail:'決まった仮説・体験・問いを編集する',href:'/dashboard/post'},
  {mark:'L',className:'green',title:'LINE Flow',detail:'教育・関係・顧客導線を動かす',href:'/dashboard/line'},
  {mark:'A',className:'blue',title:'ACE Assets',detail:'学びを教材へ変える',href:'/dashboard/ace-assets'},
] as const;
