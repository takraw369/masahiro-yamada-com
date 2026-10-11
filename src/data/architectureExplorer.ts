export type ArchitectureStatus = 'confirmed' | 'inferred' | 'unknown';
export type ArchitectureKind = 'identity' | 'upload' | 'compute' | 'chat' | 'model';

export type ArchitectureNode = {
  id: string;
  group: string;
  kind: ArchitectureKind;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  meta: string;
  status: ArchitectureStatus;
  statusLabel: string;
  body: string;
  verify: string[];
  why: string;
};

export const canonicalSystems = [
  { label: 'Google Drive / MASA_OS', role: 'Policy / Knowledge / Registry / Project Canonical' },
  { label: 'masahiro-yamada-com', role: 'PRIMARY Website / Control Plane / Dashboard' },
  { label: 'Supabase', role: 'Structured State / Relation / Runtime Data' },
  { label: 'masa-automation', role: 'Executable AI / Skill / Workflow / Automation' },
  { label: 'ace-dashboard', role: 'LAB / PORT SOURCE ONLY' },
] as const;

export const architectureExplorerData = {
  generatedAt: '2026-10-01',
  title: 'Architecture Explorer',
  subtitle: 'Target App · Convex / Modal / R2 investigation map',
  sourceState: {
    label: 'TARGET REPO NOT CONNECTED',
    summary: 'The requested Convex / Modal / R2 application is not present in the GitHub repositories currently connected to this workspace. This map intentionally separates brief-derived facts, reasonable inferences, and unresolved implementation details.',
    connectedRepoFinding: 'Connected MASA repositories do not expose a matching Convex / Modal / R2 implementation. MASA PRIMARY is currently Google Drive / Supabase / masahiro-yamada-com / masa-automation centered, so those repositories are not used as evidence for this target application.',
  },
  groups: [
    { id:'access', label:'01 · USER / ACCESS', x:70, y:120, w:2460, h:280 },
    { id:'domain', label:'02 · CONVEX / DOMAIN STATE', x:70, y:440, w:2460, h:330 },
    { id:'file', label:'03 · FILE / STORAGE / PROCESSING', x:70, y:810, w:2460, h:360 },
    { id:'ai', label:'04 · CHAT / MODEL / RESULTS', x:70, y:1210, w:2460, h:380 },
  ],
  routes: [
    { id:'signup-route', label:'Sign up → access', nodes:['visitor','signup','entitlement','userdoc'] },
    { id:'paid-route', label:'Paid user → upload', nodes:['visitor','payment','entitlement','accessdoc','project','uploadrecord','upload','r2','modal','pipeline','fileStatus'] },
    { id:'guest-route', label:'Guest pass → access', nodes:['visitor','guestpass','entitlement','accessdoc'] },
    { id:'upload-route', label:'File upload → ready', nodes:['uploadrecord','upload','r2','modal','pipeline','artifacts','fileStatus'] },
    { id:'chat-route', label:'Chat → model → persist', nodes:['chat','chatinput','context','model','response','persist'] },
  ],
  nodes: [
    { id:'visitor', group:'access', kind:'identity', x:110,y:205,w:200,h:120,title:'Visitor',meta:'not yet entitled',status:'confirmed',statusLabel:'FROM BRIEF',body:'Starting state before signup, payment, or guest access.',verify:['Find entry routes and auth guards','Search: signup, auth, guest, redirect, middleware'],why:'This defines every downstream branch.' },
    { id:'signup', group:'access', kind:'identity', x:500,y:180,w:220,h:92,title:'Sign up',meta:'account creation',status:'confirmed',statusLabel:'FROM BRIEF',body:'Account creation exists conceptually; provider and durable write path are not yet verified.',verify:['Auth provider config','User upsert/create mutation','Post-signup hooks'],why:'User identity becomes the anchor for billing, guest passes, files, and chats.' },
    { id:'payment', group:'access', kind:'identity', x:500,y:282,w:220,h:92,title:'Payment',meta:'provider unknown',status:'unknown',statusLabel:'VERIFY PROVIDER',body:'The brief says users can pay. Payment provider, webhook, and entitlement synchronization are unresolved.',verify:['Search: checkout, webhook, payment, subscription, billing','Find entitlement write after successful payment'],why:'There should be one authoritative answer to “is this user allowed?”' },
    { id:'guestpass', group:'access', kind:'identity', x:500,y:384,w:220,h:92,title:'Guest Pass',meta:'temporary entitlement?',status:'confirmed',statusLabel:'FROM BRIEF',body:'Temporary or scoped access is part of the requested user flow.',verify:['Search: guestPass, invite, token, accessGrant, expiresAt','Trace redemption → session/user → entitlement'],why:'Guest access often creates a parallel identity path that becomes hard to reason about.' },
    { id:'entitlement', group:'access', kind:'identity', x:910,y:205,w:220,h:120,title:'Entitlement Gate',meta:'who can do what?',status:'inferred',statusLabel:'INFERRED',body:'Some decision point must translate signup/payment/guest-pass state into permissions.',verify:['Locate all access guards','Identify source of truth','Check whether entitlement logic is centralized'],why:'Duplicated permission logic produces invisible drift.' },
    { id:'userdoc', group:'domain', kind:'identity', x:1325,y:515,w:230,h:110,title:'Convex: User',meta:'identity / plan / grants',status:'inferred',statusLabel:'VERIFY SCHEMA',body:'Expected durable user/account state in Convex.',verify:['convex/schema.ts user/auth tables','Mutations creating/updating users','Indexes by auth identity'],why:'Clarifies what Convex owns versus external auth/billing systems.' },
    { id:'accessdoc', group:'domain', kind:'identity', x:1325,y:635,w:230,h:110,title:'Convex: Access',meta:'subscription / guest pass',status:'inferred',statusLabel:'VERIFY SCHEMA',body:'A separate access/subscription/guest record may exist, or these fields may be embedded in User.',verify:['Schema fields: plan, role, subscriptionId, guest*, expiresAt','Webhook mutations'],why:'This establishes the entitlement source of truth.' },
    { id:'project', group:'domain', kind:'chat', x:1760,y:515,w:230,h:110,title:'Project',meta:'purpose unclear today',status:'unknown',statusLabel:'HIGH-PRIORITY VERIFY',body:'The brief says Projects are still created, but their current purpose and ownership semantics are unclear.',verify:['Search projectId everywhere','Project schema and creation callsites','Records that reference Project','Can Chats/Files exist without one?'],why:'This is likely the largest source of mental-model drift.' },
    { id:'chat', group:'domain', kind:'chat', x:1760,y:635,w:230,h:110,title:'Chat / Thread',meta:'appears independent',status:'inferred',statusLabel:'BRIEF SUGGESTS',body:'The current intuition in the brief is that Chat may actually be independent from Project.',verify:['Chat/thread schema','Required vs optional projectId','Creation callsites','Queries filtered by project'],why:'If Chats are independent, the domain model should not visually nest them under Projects.' },
    { id:'uploadrecord', group:'domain', kind:'upload', x:2180,y:515,w:250,h:110,title:'Convex: File Record',meta:'metadata + state machine',status:'inferred',statusLabel:'VERIFY SCHEMA',body:'Expected metadata record linking storage key, uploader, state, and optional Chat/Project associations.',verify:['Search schema: files, uploads, documents','Fields: r2Key/storageKey/userId/chatId/projectId/status'],why:'This bridges durable business state in Convex and bytes in R2.' },
    { id:'upload', group:'file', kind:'upload', x:2160,y:885,w:250,h:120,title:'Upload Request',meta:'client starts file flow',status:'confirmed',statusLabel:'FROM BRIEF',body:'A user initiates a file upload.',verify:['Frontend upload component/action','Signed URL endpoint or server proxy','Upload completion callback'],why:'The exact upload path determines latency, security, and failure behavior.' },
    { id:'r2', group:'file', kind:'upload', x:1690,y:885,w:250,h:120,title:'Cloudflare R2',meta:'raw file object storage',status:'confirmed',statusLabel:'FROM BRIEF',body:'The file bytes land in Cloudflare R2 somewhere.',verify:['R2 bindings/config','Object key naming convention','Signed URL generation','Delete/lifecycle policy'],why:'Object keys often encode hidden tenant/project/chat assumptions.' },
    { id:'modal', group:'file', kind:'compute', x:1300,y:885,w:250,h:120,title:'Modal',meta:'app / worker topology unclear',status:'confirmed',statusLabel:'FROM BRIEF',body:'The brief mentions Modal workers/apps but is uncertain whether this is one App with many functions or multiple deployed Apps.',verify:['modal.App(...) declarations','@app.function / @modal.function / classes','Deploy entrypoints','Queues/webhooks invoked after upload'],why:'This is the compute topology the map should make obvious.' },
    { id:'pipeline', group:'file', kind:'compute', x:860,y:885,w:250,h:120,title:'Processing Pipeline',meta:'extract → transform → index?',status:'inferred',statusLabel:'INFERRED',body:'Some asynchronous compute likely turns raw uploads into application-usable data.',verify:['Search extraction/parsing/OCR/transcode/chunk/embed/index jobs','Determine exact order, retries, and callbacks'],why:'Hidden asynchronous state transitions are a common architecture blind spot.' },
    { id:'artifacts', group:'file', kind:'upload', x:450,y:825,w:250,h:120,title:'Derived Artifacts',meta:'text / previews / chunks?',status:'unknown',statusLabel:'VERIFY',body:'Processed outputs may be written back to R2, Convex, or a different store.',verify:['Writes after Modal processing','Artifact keys / text / previews / embeddings','Where each derived output lives'],why:'Storage lifecycle and cleanup cannot be understood without this.' },
    { id:'fileStatus', group:'file', kind:'upload', x:450,y:1025,w:250,h:120,title:'Convex: File Status',meta:'queued / processing / ready?',status:'inferred',statusLabel:'INFERRED',body:'The UI probably needs a durable file-processing state machine.',verify:['Status enum and mutations','queued/processing/ready/error transitions','Which component writes each transition'],why:'This is the observable contract between asynchronous workers and product UI.' },
    { id:'chatinput', group:'ai', kind:'chat', x:450,y:1325,w:250,h:120,title:'Chat Message',meta:'user prompt + context',status:'confirmed',statusLabel:'FROM BRIEF',body:'A Chat accepts user messages and may reference files or projects.',verify:['Message creation mutation/action','Streaming route','Thread ownership'],why:'This starts the runtime inference path.' },
    { id:'context', group:'ai', kind:'chat', x:930,y:1325,w:220,h:120,title:'Context Builder',meta:'files / project / thread?',status:'unknown',statusLabel:'CRITICAL VERIFY',body:'The key unknown is how selected files, Project state, and prior messages are assembled before inference.',verify:['Find all model callsites','Track projectId/chatId/fileIds into prompt/retrieval','Prompt/context assembly','Retrieval functions'],why:'This is the real application architecture from the user’s perspective.' },
    { id:'model', group:'ai', kind:'model', x:1360,y:1325,w:220,h:120,title:'Model / LLM API',meta:'provider / routing unclear',status:'unknown',statusLabel:'VERIFY',body:'Model inference and Modal compute are separate concepts until code proves otherwise.',verify:['AI SDK/provider imports','Model routing','API key/env names','Modal functions that call models'],why:'Keeping orchestration and inference separate prevents conceptual collapse.' },
    { id:'response', group:'ai', kind:'chat', x:1790,y:1325,w:220,h:120,title:'Assistant Output',meta:'stream / persist / citations?',status:'inferred',statusLabel:'INFERRED',body:'The assistant response may stream to the client and later become durable state.',verify:['Streaming implementation','Persistence timing','Citations/attachments','Failure and cancellation states'],why:'Shows where ephemeral streaming becomes durable application state.' },
    { id:'persist', group:'ai', kind:'chat', x:2220,y:1325,w:220,h:120,title:'Convex: Message',meta:'thread persistence',status:'inferred',statusLabel:'VERIFY SCHEMA',body:'Expected durable Chat/Message history in Convex.',verify:['messages schema','Insert/update mutations','Stream-completion persistence behavior'],why:'Confirms whether Convex is the durable Chat source of truth.' },
  ] satisfies ArchitectureNode[],
  edges: [
    {from:'visitor',to:'signup',kind:'identity'}, {from:'visitor',to:'payment',kind:'identity'}, {from:'visitor',to:'guestpass',kind:'identity'},
    {from:'signup',to:'entitlement',kind:'identity'}, {from:'payment',to:'entitlement',kind:'identity'}, {from:'guestpass',to:'entitlement',kind:'identity'},
    {from:'entitlement',to:'userdoc',kind:'identity'}, {from:'entitlement',to:'accessdoc',kind:'identity'},
    {from:'userdoc',to:'project',kind:'chat'}, {from:'accessdoc',to:'chat',kind:'chat',style:'secondary'}, {from:'chat',to:'uploadrecord',kind:'chat',style:'secondary'},
    {from:'project',to:'uploadrecord',kind:'upload'}, {from:'uploadrecord',to:'upload',kind:'upload'}, {from:'upload',to:'r2',kind:'upload'},
    {from:'r2',to:'modal',kind:'upload'}, {from:'modal',to:'pipeline',kind:'compute'}, {from:'pipeline',to:'artifacts',kind:'upload',style:'secondary'}, {from:'pipeline',to:'fileStatus',kind:'upload',style:'secondary'},
    {from:'chatinput',to:'context',kind:'chat'}, {from:'context',to:'model',kind:'model'}, {from:'model',to:'response',kind:'model'}, {from:'response',to:'persist',kind:'chat',style:'secondary'},
    {from:'chat',to:'context',kind:'chat',style:'secondary'}, {from:'fileStatus',to:'context',kind:'upload',style:'secondary'},
  ],
  callouts: [
    {x:865,y:740,text:'Key unknown → Is Chat owned by Project, optionally linked, or fully independent?'},
    {x:1230,y:1140,text:'Key unknown → one Modal App with many functions vs multiple Apps / workers?'},
  ],
} as const;
