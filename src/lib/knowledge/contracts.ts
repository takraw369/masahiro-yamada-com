export type KnowledgeLifecycle =
  | 'seed'
  | 'insight'
  | 'definition'
  | 'canonical'
  | 'quest'
  | 'content'
  | 'product';

export type KnowledgeSourceType =
  | 'web'
  | 'raindrop'
  | 'pdf'
  | 'youtube'
  | 'chat'
  | 'journal'
  | 'memo'
  | 'drive'
  | 'canonical'
  | 'project'
  | 'question_answer'
  | 'research'
  | 'published';

export type KnowledgeRelationType =
  | 'supports'
  | 'contradicts'
  | 'extends'
  | 'derived_from'
  | 'mentions'
  | 'same_pattern'
  | 'part_of'
  | 'used_by';

export interface KnowledgeProvenance {
  sourceType: KnowledgeSourceType;
  sourceRef: string;
  sourceUrl?: string;
  sourceTitle?: string;
  capturedAt?: string;
  authoredAt?: string;
  extractor?: string;
  originalQuote?: string;
}

export interface KnowledgeRelation {
  id: string;
  fromUnitId: string;
  toUnitId: string;
  type: KnowledgeRelationType;
  confidence?: number;
  explicit: boolean;
  reason?: string;
  createdAt: string;
}

export interface KnowledgeUnit {
  id: string;
  title: string;
  body?: string;
  lifecycle: KnowledgeLifecycle;
  sourceType: KnowledgeSourceType;
  provenance: KnowledgeProvenance[];
  projectRefs: string[];
  personRefs: string[];
  tags: string[];
  relationCount: number;
  lastTouchedAt: string;
  createdAt: string;
  updatedAt: string;
  review?: {
    dueAt?: string;
    lastReviewedAt?: string;
    reviewCount?: number;
    resurfacingScore?: number;
  };
  outputTargets?: Array<'x' | 'threads' | 'instagram' | 'note' | 'line' | 'quest' | 'product'>;
}

export interface TodayCandidate {
  unit: KnowledgeUnit;
  score: number;
  reasons: string[];
}

export interface KnowledgeTodayModel {
  continue: TodayCandidate[];
  review: TodayCandidate[];
  promote: TodayCandidate[];
  publish: TodayCandidate[];
}

/**
 * FLOW Knowledge OS is a cockpit, not a new source of truth.
 *
 * Canonical human-readable assets stay in Drive / MASA_OS.
 * Supabase owns the integrated read/query model and relationships.
 * GitHub owns code, rules, Skills and orchestration.
 * This contract is the UI boundary shared by those layers.
 */
export interface KnowledgeCockpitSnapshot {
  generatedAt: string;
  today: KnowledgeTodayModel;
  activeUnit?: KnowledgeUnit;
  related?: KnowledgeUnit[];
  relations?: KnowledgeRelation[];
}
