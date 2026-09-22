export type VisualStructureTemplate = {
  id: string;
  name: string;
  image: string;
  bestFor: string[];
  copy: string;
  structure: string;
  promptHint: string;
  tags: string[];
};

export type VisualStructureRecommendation = {
  useCase: string;
  primary: string[];
  note: string;
};

export const visualStructureTemplates: VisualStructureTemplate[] = [
  {
    id: 'S01', name: 'アイソメトリックMAP型',
    image: '斜め上から街・基地・施設を俯瞰し、複数の要素をひとつの世界として見せる。',
    bestFor: ['PROJECT全体像', 'MASA OS', '事業ポートフォリオ', 'BASE構想'],
    copy: 'MASA｜現在進行中 PROJECT MAP',
    structure: '中心拠点を1つ置き、周囲にPROJECT・機能・人・導線を施設として配置。道路や矢印で関係性を接続する。',
    promptHint: 'isometric map, bird’s-eye view, connected districts, clear labels, one central command base',
    tags: ['MAP', '全体像', '俯瞰', '複数PROJECT'],
  },
  {
    id: 'S02', name: '富士山・ピラミッド型',
    image: '裾野から頂上へ上がる階層。広い入口から深い価値へ進む構造。',
    bestFor: ['商品設計', 'ACE導線', '顧客成長', '事業計画'],
    copy: '無料発信からACEへ。価値は階層ではなく深化する',
    structure: '下段に入口・無料接点、中段に教育・実践、上段に深い変容や中核商品。階層ごとの役割を短い言葉で示す。',
    promptHint: 'layered mountain or pyramid, wide base to focused summit, progression without superiority framing',
    tags: ['階層', '商品', '導線', '深化'],
  },
  {
    id: 'S03', name: 'シャンパンタワー型',
    image: '上段の1杯から満ち、下段へ自然に波及していく。',
    bestFor: ['MASAの思想', '人づくり', '家族', '地域', '社会'],
    copy: '国を変える前に、一番上のグラスを満たす',
    structure: '最上段に自分、次に家族・仲間、地域、社会。上が満ちることで下へ流れる因果を見せる。',
    promptHint: 'champagne tower metaphor, top glass overflowing into lower levels, self to family to community to society',
    tags: ['思想', '波及', '人づくり', '社会実装'],
  },
  {
    id: 'S04', name: 'ロードマップ型',
    image: '一本の道・駅・マイルストーンで、現在から未来への進行を見せる。',
    bestFor: ['3ヶ月計画', '1年計画', '3年計画', '講演・プレゼン'],
    copy: '今→収益基盤→資産化→自動化→社会実装',
    structure: '左を現在地、右を未来にして、3〜7個のマイルストーンを一本の道でつなぐ。各地点に成果物を置く。',
    promptHint: 'single journey road, milestone stations, now to future, clear sequential progression',
    tags: ['時間', '計画', '未来', 'マイルストーン'],
  },
  {
    id: 'S05', name: 'メトロ路線図型',
    image: '複数路線が交差し、別々の活動が同じ目的地へ収束する地下鉄MAP。',
    bestFor: ['ACE', 'AI', '発信', 'BASE', 'PROJECT全体像'],
    copy: '別々の活動に見えて、すべて同じ目的地へ向かう',
    structure: 'PROJECTごとに路線を分け、共通資産・顧客接点・社会実装などの乗換駅で交差させる。',
    promptHint: 'metro map, multiple lines, transfer stations, converging destination, clean schematic layout',
    tags: ['複数PROJECT', '接続', '統合', '目的地'],
  },
  {
    id: 'S06', name: 'フライホイール型',
    image: '円形の循環・歯車。回すほど次の工程が軽くなる。',
    bestFor: ['発信', '集客', '商品', '顧客', '口コミ', '事業計画'],
    copy: '売上は一発ではなく、回転速度で決まる',
    structure: '5〜7工程を円環に配置し、最後が最初へ戻る。中心にPurposeまたは顧客価値を置く。',
    promptHint: 'flywheel loop, circular arrows, compounding momentum, customer value at center',
    tags: ['循環', '収益', '複利', 'マーケティング'],
  },
  {
    id: 'S07', name: '生態系・エコシステム型',
    image: '森・水・太陽・土のように、異なる要素が互いを支える循環。',
    bestFor: ['Sun Loves Flow', 'コミュニティ', 'BASE構想', '循環型事業'],
    copy: '人・知識・お金が循環する、生きた事業をつくる',
    structure: '人・知識・商品・収益・場所・データを生態系の要素として配置し、矢印で交換関係を示す。',
    promptHint: 'living ecosystem, forest-water-sun metaphor, reciprocal flows, organic but structured',
    tags: ['SLF', '循環', 'コミュニティ', '生態系'],
  },
  {
    id: 'S08', name: '氷山モデル型',
    image: '水面上の見える結果と、水面下の大きな原因・構造を対比する。',
    bestFor: ['行動と無意識', '身体性', 'ACE思想', 'SNS投稿'],
    copy: '結果として見えるものは、全体のほんの一部',
    structure: '水面上に成果・行動・数字、水面下に状態・身体・習慣・環境・信念などを階層配置する。',
    promptHint: 'iceberg above and below water, visible outcomes vs hidden drivers, strong depth contrast',
    tags: ['因果', '無意識', '身体', '教育'],
  },
  {
    id: 'S09', name: 'OSレイヤー型',
    image: 'PC OSのように、基盤からアプリまでを積層して見せる。',
    bestFor: ['MASA OS', 'AI活用', '人間OS', '仕組み化'],
    copy: '人生も事業も、アプリよりOSから整える',
    structure: '最下層にPurpose・原則、その上にデータ・知識・判断・自動化、最上層に具体アプリやアウトプットを置く。',
    promptHint: 'technology stack layers, foundation to applications, operating system architecture, precise labels',
    tags: ['OS', 'AI', '基盤', '構造'],
  },
  {
    id: 'S10', name: '神経回路・脳ネットワーク型',
    image: 'ニューロンやノードがつながり、知識・AI・人がネットワークを形成する。',
    bestFor: ['脳科学', 'AI活用', '人・知識ネットワーク', '学習'],
    copy: '知識量ではなく、接続数が知性をつくる',
    structure: '中心ノードから関連ノードを放射し、重要な接続を太くする。孤立情報より関係性を主役にする。',
    promptHint: 'neural network nodes, synaptic connections, knowledge graph, human-AI collaboration',
    tags: ['脳科学', 'AI', 'ネットワーク', '知識'],
  },
  {
    id: 'S11', name: 'Before→Bridge→After型',
    image: '左に現状、中央に橋、右に未来。変化の手段を中央に置く。',
    bestFor: ['コーチング', '商品LP', 'ACE説明', '顧客変容'],
    copy: '今の自分から、なりたい自分へ。その橋がACE',
    structure: '左に痛み・停滞、右に望む状態。中央のBridgeに方法・プログラム・実践ステップを置く。',
    promptHint: 'before bridge after, left present state, central method, right desired future, transformation journey',
    tags: ['変容', 'LP', '商品説明', 'コーチング'],
  },
  {
    id: 'S12', name: 'QUEST / RPGマップ型',
    image: '村・山・ステージ・ボス・宝箱で、成長プロセスを冒険として見せる。',
    bestFor: ['Athlete Quest', '教育コンテンツ', '継続設計', 'ゲーミフィケーション'],
    copy: '人生を攻略するのではなく、成長する旅に変える',
    structure: 'START地点から複数ステージを進み、各地点にQuest・Skill・Reward・Bossを配置。ゴール後に次世界への扉を置く。',
    promptHint: 'RPG world map, stages, village, mountain, boss gate, treasure rewards, educational progression',
    tags: ['Quest', '教育', 'ゲーム', '成長'],
  },
  {
    id: 'S13', name: '木・ROOTS型',
    image: '根→幹→枝→果実。見える成果の下に思想や歴史を置く。',
    bestFor: ['思想系譜', '歴史', '教育', '人生ストーリー'],
    copy: '思想は根、教育は幹、事業は枝、社会変化は果実',
    structure: '根に思想・先人・原体験、幹に教育原則、枝にPROJECT、果実に社会への成果を配置する。',
    promptHint: 'tree roots trunk branches fruits, intellectual lineage, education to projects to social outcomes',
    tags: ['ROOTS', '思想', '歴史', '系譜'],
  },
  {
    id: 'S14', name: '惑星・宇宙型',
    image: '中心惑星と衛星。ひとつの重力圏に複数PROJECTが公転する。',
    bestFor: ['MASAブランド', 'Sun Loves Flow', '複数PROJECT', 'ブランド構造'],
    copy: 'MASAという重力圏に、複数のPROJECTが公転する',
    structure: '中心にブランドPurpose、周囲にPROJECTや商品を軌道別に配置。距離で中核度や関係の強さを示す。',
    promptHint: 'central planet with orbiting projects, gravity system, brand ecosystem, clean cosmic diagram',
    tags: ['ブランド', '宇宙', 'PROJECT', '重力'],
  },
  {
    id: 'S15', name: '建築断面図型',
    image: '建物の地下から屋上まで。成果を支える見えない構造を可視化する。',
    bestFor: ['人間成長', '事業基盤', '組織', '能力開発'],
    copy: '見える成果は屋上。強さを決めるのは地下構造',
    structure: '地下に身体・安全・習慣、1階以降に技能・関係・収益・影響力、屋上に成果や社会実装を置く。',
    promptHint: 'architectural cutaway section, basement foundations to rooftop outcomes, labeled floors',
    tags: ['基盤', '成長', '組織', '構造'],
  },
  {
    id: 'S16', name: '川・FLOW型',
    image: '源流→支流→大河→海。小さな流れが合流し、止まらず大きくなる。',
    bestFor: ['Sun Loves Flow', '人生哲学', 'MASAの思想', '資産化'],
    copy: '小さな流れを止めず、やがて大河にする',
    structure: '源流に体験・問い、支流に知識・人・発信、大河に商品・コミュニティ、海に社会実装を置く。',
    promptHint: 'river flow from source to tributaries to large river to ocean, compounding ideas and action',
    tags: ['FLOW', '思想', '循環', '資産化'],
  },
  {
    id: 'S17', name: 'コンパス型',
    image: '北・南・東・西と中心。判断軸と方向性を一目で確認する。',
    bestFor: ['意思決定', '価値観', 'Want to', 'Choice'],
    copy: '正解を探すより、自分の北極星を決める',
    structure: '中心に現在の問い、北にPurpose、東西南に主要判断軸。外周に避ける方向や境界条件も置ける。',
    promptHint: 'compass diagram, north star purpose, four decision dimensions, centered current question',
    tags: ['判断', '価値観', 'Purpose', '方向'],
  },
  {
    id: 'S18', name: 'マトリクス型',
    image: '2×2または3×3。複数案を二つの軸で整理し、配置で意味を見せる。',
    bestFor: ['優先順位', '商品整理', '意思決定', 'SNS投稿'],
    copy: '緊急性ではなく、収益性×資産性で選ぶ',
    structure: '横軸と縦軸を明示し、各象限の意味を短く命名。施策やPROJECTを点・カードで配置する。',
    promptHint: '2x2 matrix, two labeled axes, quadrant names, plotted initiatives, clean decision framework',
    tags: ['2×2', '優先順位', '比較', '意思決定'],
  },
  {
    id: 'S19', name: 'タイムライン・歴史絵巻型',
    image: '過去→現在→未来。出来事と意味の変化を一本の時間軸で見せる。',
    bestFor: ['アスリート人生', '思想系譜', '人生ストーリー', '講演・プレゼン'],
    copy: '競技人生20年は、ACE誕生の前史だった',
    structure: '左から右へ時代を並べ、各転機に出来事・学び・次への接続を置く。最後に未来の未完成領域を残す。',
    promptHint: 'historical timeline scroll, past present future, turning points, lessons and future continuation',
    tags: ['歴史', 'ストーリー', '時間', '講演'],
  },
  {
    id: 'S20', name: 'ドミノ型',
    image: '小さな一枚が次の一枚へ連鎖し、大きな変化を起こす。',
    bestFor: ['習慣', '行動変容', '108習慣', 'SNS投稿'],
    copy: '人生を変えるのは、大きな決断より最初の一枚',
    structure: '最初に最小行動を置き、その先に習慣・状態・成果・人生変化を連鎖させる。最初の一手を強調する。',
    promptHint: 'domino chain reaction, small first tile causing larger outcomes, habit to identity to results',
    tags: ['習慣', '行動', '連鎖', '小さな一歩'],
  },
];

export const visualStructureRecommendations: VisualStructureRecommendation[] = [
  { useCase: 'PROJECT全体像', primary: ['S01', 'S05'], note: '俯瞰するならMAP、関係性を強く見せるなら路線図。' },
  { useCase: 'ACE商品説明', primary: ['S02', 'S11'], note: '価値の深化は富士山、変容の説明はBridge。' },
  { useCase: 'MASAの思想', primary: ['S03', 'S16'], note: '波及はシャンパンタワー、循環はFLOW。' },
  { useCase: 'MASA OS', primary: ['S09', 'S01'], note: '内部構造はOSレイヤー、全体配置は管制塔的MAP。' },
  { useCase: 'Athlete Quest', primary: ['S12'], note: '成長・選択・報酬を一つの旅として扱う。' },
  { useCase: 'Sun Loves Flow', primary: ['S07', 'S16', 'S14'], note: '循環、生きた流れ、複数PROJECTの重力圏を使い分ける。' },
  { useCase: '人生ストーリー', primary: ['S19', 'S13'], note: '時間で語るなら歴史絵巻、思想の源流で語るならROOTS。' },
  { useCase: 'SNS投稿', primary: ['S08', 'S18', 'S20'], note: '1枚で伝わる「見える/見えない」「2軸」「連鎖」が強い。' },
  { useCase: '講演・プレゼン', primary: ['S19', 'S04'], note: 'ストーリーで入り、ロードマップで未来へ接続する。' },
  { useCase: '事業計画', primary: ['S06', 'S02'], note: '循環構造はFlywheel、商品階層は富士山。' },
  { useCase: 'AI活用', primary: ['S10', 'S09'], note: '人・AI・知識の接続は神経回路、運用構造はOSレイヤー。' },
  { useCase: 'BASE構想', primary: ['S01', 'S07'], note: '場所の全体像は地図、そこで起こる循環はエコシステム。' },
];

export function getVisualStructureTemplate(id: string) {
  return visualStructureTemplates.find((template) => template.id === id);
}
