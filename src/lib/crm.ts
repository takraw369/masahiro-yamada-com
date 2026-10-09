export const CRM_SCENE_KEY = 'crm';

export const CRM_STAGES = [
  'DISCOVERED',
  'WARM',
  'CONVERSATION',
  'OPPORTUNITY',
  'CUSTOMER',
  'DELIVERED',
  'ALUMNI',
  'PAUSED',
] as const;

export type CrmStage = typeof CRM_STAGES[number];

export type CrmContact = {
  version: 1;
  id: string;
  name: string;
  organization: string;
  role: string;
  relation: string;
  stage: CrmStage;
  opportunity: string;
  nextAction: string;
  nextAt: string;
  lastContactAt: string;
  valueYen: number;
  source: string;
  tags: string[];
  notes: string;
  referenceUrl: string;
  updatedAt: string;
};

type CrmNode = {
  [key: string]: unknown;
  id: string;
  label: string;
  note?: string;
  kind?: string;
  x: number;
  y: number;
  w?: number;
  h?: number;
  provenance?: string;
  crmContact: CrmContact;
};

export type CrmSnapshot = {
  [key: string]: unknown;
  nodes: CrmNode[];
  edges: unknown[];
  viewport: { x: number; y: number; zoom: number };
};

const MAX_CONTACTS = 250;
const CONTROL_CHARS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/;
const CONTACT_ID_RE = /^crm:[a-zA-Z0-9_-]{6,120}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function fail(message: string): never {
  throw new Error(message);
}

function cleanText(value: unknown, field: string, max: number) {
  if (typeof value !== 'string' || value.length > max || value !== value.trim() || CONTROL_CHARS.test(value)) {
    fail(`crm_invalid_field:${field}`);
  }
}

function validDate(value: string) {
  if (!value) return true;
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validHttpsUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function validateCrmContact(value: unknown): asserts value is CrmContact {
  if (!record(value) || value.version !== 1 || typeof value.id !== 'string' || !CONTACT_ID_RE.test(value.id)) {
    fail('crm_invalid_contact');
  }
  if (!CRM_STAGES.includes(value.stage as CrmStage)) fail('crm_invalid_stage');

  cleanText(value.name, 'name', 160);
  if (!value.name) fail('crm_name_required');
  cleanText(value.organization, 'organization', 200);
  cleanText(value.role, 'role', 160);
  cleanText(value.relation, 'relation', 160);
  cleanText(value.opportunity, 'opportunity', 300);
  cleanText(value.nextAction, 'nextAction', 600);
  cleanText(value.nextAt, 'nextAt', 10);
  cleanText(value.lastContactAt, 'lastContactAt', 10);
  cleanText(value.source, 'source', 200);
  cleanText(value.notes, 'notes', 2400);
  cleanText(value.referenceUrl, 'referenceUrl', 1500);
  cleanText(value.updatedAt, 'updatedAt', 40);

  if (!validDate(value.nextAt as string)) fail('crm_invalid_date:nextAt');
  if (!validDate(value.lastContactAt as string)) fail('crm_invalid_date:lastContactAt');
  if (!validHttpsUrl(value.referenceUrl as string)) fail('crm_invalid_reference_url');
  if (!Number.isSafeInteger(value.valueYen) || (value.valueYen as number) < 0 || (value.valueYen as number) > 1_000_000_000) {
    fail('crm_invalid_value');
  }
  if (!Array.isArray(value.tags) || value.tags.length > 10) fail('crm_invalid_tags');
  for (const tag of value.tags) cleanText(tag, 'tag', 40);
  if (new Set(value.tags as string[]).size !== value.tags.length) fail('crm_duplicate_tags');
  if (!Number.isFinite(Date.parse(value.updatedAt as string))) fail('crm_invalid_updated_at');

  const allowed = new Set([
    'version', 'id', 'name', 'organization', 'role', 'relation', 'stage', 'opportunity',
    'nextAction', 'nextAt', 'lastContactAt', 'valueYen', 'source', 'tags', 'notes',
    'referenceUrl', 'updatedAt',
  ]);
  if (Object.keys(value).some(key => !allowed.has(key))) fail('crm_unknown_contact_field');
}

export function createCrmSnapshot(): CrmSnapshot {
  return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };
}

export function validateCrmBoardSnapshot(value: unknown): asserts value is CrmSnapshot {
  if (!record(value) || !Array.isArray(value.nodes) || !Array.isArray(value.edges)) fail('crm_invalid_snapshot');
  if (value.nodes.length > MAX_CONTACTS) fail('crm_too_many_contacts');
  if (value.edges.length > 0) fail('crm_edges_not_supported');

  const seen = new Set<string>();
  for (const raw of value.nodes) {
    if (!record(raw) || typeof raw.id !== 'string' || !CONTACT_ID_RE.test(raw.id)) fail('crm_invalid_node');
    if (seen.has(raw.id)) fail('crm_duplicate_contact');
    seen.add(raw.id);
    validateCrmContact(raw.crmContact);
    if ((raw.crmContact as CrmContact).id !== raw.id) fail('crm_contact_id_mismatch');
  }

  if (value.viewport !== undefined) {
    if (!record(value.viewport)
      || typeof value.viewport.x !== 'number'
      || typeof value.viewport.y !== 'number'
      || typeof value.viewport.zoom !== 'number'
      || !Number.isFinite(value.viewport.x)
      || !Number.isFinite(value.viewport.y)
      || !Number.isFinite(value.viewport.zoom)) fail('crm_invalid_viewport');
  }
}

export function getCrmContacts(snapshot: unknown): CrmContact[] {
  validateCrmBoardSnapshot(snapshot);
  return snapshot.nodes.map(node => structuredClone(node.crmContact));
}

export function createCrmContact(id: string, now = new Date()): CrmContact {
  if (!CONTACT_ID_RE.test(id)) fail('crm_invalid_contact_id');
  return {
    version: 1,
    id,
    name: '',
    organization: '',
    role: '',
    relation: '',
    stage: 'DISCOVERED',
    opportunity: '',
    nextAction: '',
    nextAt: '',
    lastContactAt: '',
    valueYen: 0,
    source: '',
    tags: [],
    notes: '',
    referenceUrl: '',
    updatedAt: now.toISOString(),
  };
}

export function upsertCrmContact(snapshot: CrmSnapshot, contact: CrmContact): CrmSnapshot {
  validateCrmBoardSnapshot(snapshot);
  validateCrmContact(contact);
  const next = structuredClone(snapshot);
  const node: CrmNode = {
    id: contact.id,
    label: contact.name,
    note: `${contact.stage}${contact.nextAction ? ` · ${contact.nextAction}` : ''}`,
    kind: 'HUMAN',
    x: 0,
    y: 0,
    w: 260,
    h: 110,
    provenance: 'relationship-os-v1',
    crmContact: structuredClone(contact),
  };
  const index = next.nodes.findIndex(item => item.id === contact.id);
  if (index >= 0) next.nodes[index] = node;
  else next.nodes.push(node);
  return next;
}

export function removeCrmContact(snapshot: CrmSnapshot, id: string): CrmSnapshot {
  validateCrmBoardSnapshot(snapshot);
  if (!CONTACT_ID_RE.test(id)) fail('crm_invalid_contact_id');
  const next = structuredClone(snapshot);
  next.nodes = next.nodes.filter(node => node.id !== id);
  return next;
}

export function getCrmStats(contacts: CrmContact[], today = new Date().toISOString().slice(0, 10)) {
  const due = contacts.filter(contact => contact.nextAction && (!contact.nextAt || contact.nextAt <= today)).length;
  const opportunities = contacts.filter(contact => ['CONVERSATION', 'OPPORTUNITY'].includes(contact.stage)).length;
  const customers = contacts.filter(contact => ['CUSTOMER', 'DELIVERED', 'ALUMNI'].includes(contact.stage)).length;
  const pipelineYen = contacts
    .filter(contact => ['CONVERSATION', 'OPPORTUNITY'].includes(contact.stage))
    .reduce((sum, contact) => sum + contact.valueYen, 0);
  return { total: contacts.length, due, opportunities, customers, pipelineYen };
}
