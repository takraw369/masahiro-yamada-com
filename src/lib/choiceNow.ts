export type ChoiceNowOption = [id: string, label: string, note: string];

export type ChoiceNowQuestion = {
  id: string;
  area: string;
  title: string;
  why: string;
  options: ChoiceNowOption[];
  tags: string[];
  weight?: number;
};

export const choiceNowQuestions: ChoiceNowQuestion[] = [
  {id:'focus-now',area:'PRIORITY',title:'今週、いちばん前へ進めるなら？',why:'複数のProjectが同時進行している時ほど、中心を1つ決めると他の判断が速くなる。',tags:['priority','project','dashboard','offer','ace','focus','今週','優先','売上','教育'],weight:4,options:[['control-plane','Dashboard / MASA OS','全体の使いやすさと判断速度を上げる'],['revenue','売上につながるOffer','販売・顧客・導線を先に前進'],['ace','ACE / 教育','教育資産とプログラムを育てる']]},
  {id:'next-lab',area:'CHOICE LAB',title:'Designの次に「選べる化」するなら？',why:'次のLabを1つ開くと、Choice Labが実際の判断装置として育ち始める。',tags:['choice','design','priority','words','offer','lab','選択','判断'],weight:3,options:[['priority','PRIORITY','今やる / 後 / 捨てるを比較'],['words','WORDS','名前・見出し・CTAを比較'],['offer','OFFER','価格・構成・入口を比較']]},
  {id:'brand-front',area:'BRAND',title:'個人ブランドの正面に何を置く？',why:'MASA / SLF / ACEの役割を整理すると、発信と商品導線の迷いが減る。',tags:['brand','masa','slf','ace','sns','identity','ブランド','発信'],weight:3,options:[['masa','MASA','本人を入口にして各世界へつなぐ'],['slf','Sun Loves Flow','思想・Flowを入口にする'],['ace','ACE','教育・Athleteを入口にする']]},
  {id:'offer-front',area:'OFFER',title:'最初に磨く「買える入口」は？',why:'商品を増やすより、まず1つの入口を強くした方が検証しやすい。',tags:['offer','product','revenue','customer','coaching','sprint','価格','商品','売上','顧客'],weight:4,options:[['sprint','短期Sprint','短期間・明確な成果の入口'],['coaching','1対1 Coaching','深い伴走と高単価の入口'],['program','ACE / 教育Program','体系化された継続商品']]},
  {id:'choice-rhythm',area:'SYSTEM',title:'AIから「NOW 5」を出すタイミングは？',why:'多すぎる提案はノイズ。少なすぎると判断が滞る。',tags:['ai','choice','system','automation','rhythm','notification','提案','自動化'],weight:3,options:[['open','Choice Labを開いた時','自分のタイミングを優先'],['daily','1日1回','日次で小さく判断する'],['event','変化があった時','Projectや情報更新をTriggerにする']]},
  {id:'dashboard-home',area:'SYSTEM',title:'Dashboardの最初の画面で一番見たいのは？',why:'ホームの主役を決めると、情報を足しても散らかりにくい。',tags:['dashboard','system','action','signal','state','home','画面','次の行動'],weight:3,options:[['next','次のAction','今やることを最優先'],['state','今の状態','Project・生活・流れの俯瞰'],['signals','変化 / Signal','更新・異常・新着を優先']]},
  {id:'content-source',area:'CONTENT',title:'発信の起点をどこに置く？',why:'入口を決めると、複数SNSへ展開する時の重複作業が減る。',tags:['content','sns','drive','research','project','conversation','発信','資産化'],weight:3,options:[['thinking','日々の思考 / 会話','会話から自然に資産化'],['project','Project進捗','実践ログを発信へ変換'],['library','Research / Drive','蓄積知識を編集して発信']]},
  {id:'graph-role',area:'GRAPH',title:'Brain Graphで最初に強く見たい関係は？',why:'全部の関係を同じ強さで見せない方が、Graphは道具として使いやすい。',tags:['graph','knowledge','evidence','flow','current','brain','node','資産','関係'],weight:2,options:[['now','今動いているもの','Current focusを中心へ'],['cause','原因 → 結果','因果とEvidenceを強調'],['flow','資産 → Output','知識が商品・発信へ流れる経路']]},
  {id:'asset-rule',area:'ASSET',title:'何を最優先で「資産」に昇格させる？',why:'保存量より再利用基準を決めた方が、DriveとKnowledge Graphが軽くなる。',tags:['asset','drive','knowledge','evidence','reuse','canonical','資産','再利用','正本'],weight:3,options:[['reuse','再利用したもの','実際に2回以上使えた'],['evidence','Evidenceがあるもの','結果や根拠が返ってきた'],['core','Coreと整合するもの','Purpose / 原則との一致を優先']]},
  {id:'ai-autonomy',area:'AI',title:'AIはどこまで先回りしてよい？',why:'自動化の強さを決めると、便利さと主導権の境界が明確になる。',tags:['ai','automation','approval','agent','system','自動化','承認','先回り'],weight:3,options:[['suggest','提案まで','実行は必ずMASAが選ぶ'],['prepare','下書き・準備まで','すぐ承認できる状態まで作る'],['safe-auto','安全な範囲は自動','可逆・低リスクのみ先に進める']]},
  {id:'proof-first',area:'OFFER',title:'商品ページで最初に見せるなら？',why:'説明より先に何を見せるかで、伝わり方が大きく変わる。',tags:['offer','page','sales','evidence','result','method','why','商品','販売','結果'],weight:2,options:[['result','結果 / Before→After','変化を先に見せる'],['method','Method / Flow','どう進むかを先に見せる'],['belief','思想 / Why','なぜやるかを先に見せる']]},
  {id:'brand-tone',area:'BRAND',title:'MASAの発信の基本トーンは？',why:'内容ごとに変えても、基準となる声が1つあると全体がまとまる。',tags:['brand','voice','content','sns','tone','words','発信','言葉'],weight:2,options:[['clear','明快・端的','余計な装飾を減らす'],['warm','温かい・寄り添う','人との距離を近くする'],['provoking','問いを投げる','考えたくなる余白を作る']]},
  {id:'social-lead',area:'DISTRIBUTION',title:'発信の主戦場を1つ決めるなら？',why:'全媒体を同時に最適化するより、1つを検証場にすると速い。',tags:['distribution','sns','x','instagram','note','content','発信','配信'],weight:2,options:[['x','X','思考・速報・対話を主軸'],['instagram','Instagram','Visual・世界観・教育を主軸'],['note','note / Longform','体系化・深掘りを主軸']]},
  {id:'community-shape',area:'COMMUNITY',title:'人が集まる場の基本形は？',why:'囲うか、流動性を持たせるかで運営設計が変わる。',tags:['community','guild','circle','network','people','組織','仲間','場'],weight:2,options:[['circle','小さなCircle','深い関係を少人数で'],['guild','Guild / Project型','目的ごとに集まり解散'],['open','Open Network','出入り自由で接点を広げる']]},
  {id:'feedback-speed',area:'LEARNING',title:'実装後、いつ評価する？',why:'評価時点を揃えると「初見」と「日常使用」を混同しにくい。',tags:['feedback','learning','design','review','evidence','評価','検証','使用'],weight:2,options:[['instant','その場','3秒 / 触感を重視'],['day','24時間後','一度離れて再評価'],['week','1週間使用後','習慣としての使いやすさを重視']]},
  {id:'automation-trigger',area:'SYSTEM',title:'自動化は何をTriggerに動くのが自然？',why:'時間起点か、出来事起点かでOS全体の感覚が変わる。',tags:['automation','trigger','event','schedule','workflow','system','自動化','時間'],weight:3,options:[['event','出来事','保存・投稿・完了などをTrigger'],['schedule','時間','朝・週次など一定リズム'],['hybrid','Hybrid','基本はEvent、Reviewだけ時間']]},
  {id:'notification-rule',area:'SYSTEM',title:'通知する価値があるのは？',why:'通知の基準を絞ると、重要Signalが埋もれにくい。',tags:['notification','signal','risk','action','change','alert','通知','異常'],weight:2,options:[['action','Actionが必要','返答・承認・期限がある'],['change','意味ある変化','状況が前回から変わった'],['risk','Risk / 異常','失敗・期限・矛盾を優先']]},
  {id:'archive-rule',area:'KNOWLEDGE',title:'「今は使わない知識」をどう扱う？',why:'全部を前面に置かず、Dormantに落とす基準があるとGraphが育てやすい。',tags:['knowledge','archive','graph','dormant','drive','知識','整理','保存'],weight:2,options:[['fade','薄く残す','検索可能だが通常は目立たせない'],['archive','Archiveへ移す','明確に現役から外す'],['review','定期Review','一定期間ごとに再判定']]},
  {id:'decision-revisit',area:'CHOICE LAB',title:'過去の選択をいつ見直す？',why:'Choiceを永久Ruleにせず、Evidenceで更新できるようにする。',tags:['choice','decision','evidence','review','conflict','rule','判断','見直し'],weight:3,options:[['evidence','Evidenceが返った時','結果が出たら再判定'],['conflict','矛盾した時','別の選択とぶつかったら再判定'],['monthly','月1 Review','まとめて棚卸し']]},
  {id:'next-30',area:'OUTCOME',title:'次の30日で「進んだ」と言える状態は？',why:'成果の定義が1つあると、細かい優先順位をそこへ寄せられる。',tags:['outcome','revenue','system','asset','30','goal','成果','売上','資産'],weight:4,options:[['revenue','売上が生まれた','顧客と取引のEvidence'],['system','OSが日常で回る','毎日使える運用状態'],['asset','資産が増え再利用された','知識→Outputの循環']]},
];

export const fallbackChoiceNow = (limit = 5) => choiceNowQuestions
  .slice()
  .sort((a,b)=>(b.weight ?? 0)-(a.weight ?? 0))
  .slice(0, Math.max(1, Math.min(limit, 10)));
