import type { KnowledgeItem, Snapshot } from './model.ts';
const projects = [
  { id: 'ace', name: 'ACE', description: '人の可能性を、惹き出す', color: '#5266ac' },
  { id: 'slf', name: 'SLF', description: '自然体で、流れをつくる', color: '#287968' },
  { id: 'yakuzen', name: 'YAKUZEN', description: '季節と身体をつなぐ', color: '#a56a38' },
];
const themes = [{ id: 'psychology', name: 'Psychological Defense' }, { id: 'flow', name: 'Flow Research' }, { id: 'food', name: 'Seasonal Food' }, { id: 'knowledge', name: 'Knowledge Design' }];
const tags = ['心理的安全性', 'コーチング', 'フロー', '身体知', '季節', '食養生', '知識設計', '創造性'].map((name, i) => ({ id: `tag-${i}`, name }));
// Editorial examples, not fetched summaries or actual MASA private records.
const samples: Array<Partial<KnowledgeItem> & Pick<KnowledgeItem, 'title' | 'url' | 'summary'>> = [
  { title: '人は「安心できる」ときに、変わりはじめる', url: 'https://www.apa.org/topics/resilience', summary: '防御を解くには、説得よりも安心できる環境から。ACEの「惹き出す」を考えるための視点。', theme_id: 'psychology', tag_ids: ['tag-0', 'tag-1'], asset_score: 92, status: 'review', next_action: 'ACEの導入セッションとの接点を考える' },
  { title: 'フローは、集中を強いることからは生まれない', url: 'https://www.youtube.com/watch?v=fXIeFJCqsPs', source_type: 'youtube', summary: '挑戦とスキルの釣り合いが、没頭への入口になる。SLFの日常設計へつなぐためのメモ。', theme_id: 'flow', tag_ids: ['tag-2', 'tag-3'], asset_score: 88, next_action: '日常に取り入れられる条件を3つ選ぶ' },
  { title: '季節の変わり目を、食から整える', url: 'https://www.maff.go.jp/j/syokuiku/', summary: '旬を知ることは、身体の変化に気づくこと。秋の食養生コンテンツを考える材料に。', theme_id: 'food', tag_ids: ['tag-4', 'tag-5'], asset_score: 76, next_action: '秋の食材と身体のサインを整理する' },
  { title: '情報を集めるより、使えるつながりをつくる', url: 'https://en.wikipedia.org/wiki/Personal_knowledge_management', summary: '保存先ではなく、使う場面から情報を整理する。Knowledge Flowの設計に戻ってきたい視点。', theme_id: 'knowledge', tag_ids: ['tag-6'], asset_score: 84, next_action: '自分の保存習慣と照らし合わせる' },
  { title: 'よい問いは、答えを急がない', url: 'https://www.edutopia.org/topic/inquiry-based-learning/', summary: '問いに余白を残すことで、自分の言葉が生まれる。コーチングの問い方を見直すきっかけ。', tag_ids: ['tag-1', 'tag-7'], status: 'review', asset_score: 72, next_action: '試してみたい問いをひとつ残す' },
  { title: 'Psychological Defense — 防御を理解する', url: 'https://en.wikipedia.org/wiki/Defence_mechanism', summary: '防御を問題ではなく、自分を守る反応として捉える。ACEの対話設計に接続したリサーチメモ。', project_ids: ['ace'], theme_id: 'psychology', tag_ids: ['tag-0', 'tag-1'], status: 'developing', asset_score: 94, output: 'ACE / 安心から始めるセッション', next_action: '導入で使う問いを3つ書く' },
  { title: 'Flow Research — 自然に集中できる環境', url: 'https://en.wikipedia.org/wiki/Flow_(psychology)', summary: '集中を意志だけに任せず、環境の条件を整える。SLFの実践ガイドの構成へ。', project_ids: ['slf'], theme_id: 'flow', tag_ids: ['tag-2', 'tag-3'], status: 'ready', asset_score: 90, output: 'SLF / フローの入口・実践ガイド', next_action: '公開前に出典と表現を確認する' },
  { title: 'Seasonal Food — 秋を迎える食のノート', url: 'https://www.maff.go.jp/j/keikaku/syokubunka/k_ryouri/', summary: '食材と季節を一緒に伝える、小さな食養生ノート。YAKUZENの発信候補として整理。', project_ids: ['yakuzen'], theme_id: 'food', tag_ids: ['tag-4', 'tag-5'], status: 'connected', asset_score: 81, output: 'YAKUZEN / 秋の食養生ノート', next_action: '食材ごとの根拠を確認する' },
  { title: '身体から考える、という選択肢', url: 'https://en.wikipedia.org/wiki/Embodied_cognition', summary: '頭だけで解決しようとするとき、身体の感覚に戻る。ACEのBody-firstを再考する素材。', project_ids: ['ace'], theme_id: 'psychology', tag_ids: ['tag-3'], status: 'understood', asset_score: 86, next_action: 'Body-firstの既存ノートと比較する' },
];
export function createFixture(now = new Date()): Snapshot {
  const items = samples.map((sample, i): KnowledgeItem => {
    const created = new Date(now.getTime() - (i + 1) * 86400000).toISOString();
    const updated = i === 8 ? new Date(now.getTime() - 220 * 86400000).toISOString() : created;
    return { id: `demo-${i + 1}`, source_type: 'web', thumbnail_url: null, raw_content: null,
      status: 'inbox', asset_score: null, tag_ids: [], project_ids: [], theme_id: null, output: '', next_action: '',
      created_at: i === 8 ? updated : created, updated_at: updated, connected_at: sample.project_ids?.length ? created : null,
      ...sample };
  });
  return { version: 1, revision: 0, items, projects, themes, tags };
}
