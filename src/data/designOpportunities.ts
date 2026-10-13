/**
 * Curated Design Opportunity snapshot.
 * Drive (MASA DESIGN INTELLIGENCE) remains the canonical owner.
 * This module does NOT claim live synchronization or automatic AI discovery.
 */
export type DesignOpportunity = {
  id: string;
  title: string;
  ability: string;
  method: string;
  uses: string[];
  nextAction: string;
  command: string;
  status: 'TRY' | 'KEEP' | 'PROMOTE' | 'DROP';
  destination: string;
  canonicalUrl: string;
  sourceUrl: string;
};

export const designOpportunities: DesignOpportunity[] = [
  {
    id: 'TRG-VISUAL-EDIT-001',
    title: '画像を「ここだけ」直せる',
    ability: '完成画像を全作り直しせず、変える場所と保持する場所を明示して部分編集できる',
    method: 'CHANGE → LOCK → VERIFY',
    uses: ['SNS画像差し替え', '広告A/B', 'キャラクターの一貫性', 'Storyboard', '教材図解'],
    nextAction: '既存画像1枚で1箇所だけ変更し、元画像と比較する',
    command: 'この画像、ここだけ直して',
    status: 'TRY',
    destination: '/dashboard/visual-prompt',
    canonicalUrl: 'https://docs.google.com/document/d/1R6wZnUzXO4YPsbm-MJ2OMfL4f0BvVy7PUlKUG6Y9N6M/edit',
    sourceUrl: 'https://x.com/niramayo2096/status/2100141514492117059',
  },
];

export const activeDesignOpportunities = designOpportunities.filter(
  item => item.status === 'TRY' || item.status === 'KEEP'
).slice(0, 5);
