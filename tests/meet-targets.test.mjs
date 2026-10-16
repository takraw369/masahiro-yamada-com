import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createCrmContact, createCrmSnapshot, getCrmContacts, upsertCrmContact,
  validateCrmContact, validateCrmBoardSnapshot,
} from '../src/lib/crm.ts';
import {
  isMeetTarget, meetTargets, newMeetTarget, mergeMeetTarget,
  MEET_TARGET_STATUS_LABELS,
} from '../src/lib/meetTargets.ts';

const now = new Date('2026-10-16T05:00:00Z');
const make = (id,name,priority='A',status='WISH') => mergeMeetTarget(newMeetTarget(id,now),{
  name,priority,status,organization:'教育団体',role:'指導者',
  purpose:'体験を聞いてみたい',introductionVia:'紹介経路は未確認',
  nextAction:'公開イベントを調べる',nextAt:'2026-11-01',
  tags:['教育','アスリート'],referenceUrl:'https://example.com/profile',
},now);

test('Meet Target metadata is validated within the SAME Relationship OS canonical contact', () => {
  const a=make('crm:meetone001','Aさん');
  validateCrmContact(a);
  let scene=createCrmSnapshot();
  scene=upsertCrmContact(scene,a);
  assert.equal(scene.nodes.length,1);
  const b=getCrmContacts(scene)[0];
  assert.equal(b.id,'crm:meetone001');
  assert.equal(b.meetTarget.priority,'A');
  assert.equal(b.meetTarget.status,'WISH');
  assert.equal(b.meetTarget.introductionVia,'紹介経路は未確認');
  assert.equal(b.nextAction,'公開イベントを調べる');
  validateCrmBoardSnapshot(scene);
});

test('Promotion of existing contact preserves identity, other CRM fields, and historic notes', () => {
  const old={...createCrmContact('crm:oldcontact01',now),name:'既存の人',relation:'コーチ',notes:'既存の記録',stage:'CONVERSATION',source:'LINE'};
  const converted=mergeMeetTarget(old,{name:old.name,organization:'',role:'',priority:'S',status:'INTRO_REQUESTED',
    purpose:'教育について話したい',introductionVia:'候補だけ',nextAction:'紹介について確認',nextAt:'',
    referenceUrl:'',tags:[]},now);
  assert.equal(converted.id,old.id);
  assert.equal(converted.source,'LINE');
  assert.equal(converted.stage,'CONVERSATION');
  assert.equal(converted.notes,'既存の記録');
  assert.ok(isMeetTarget(converted));
  const scene=upsertCrmContact(upsertCrmContact(createCrmSnapshot(),old),converted);
  assert.equal(getCrmContacts(scene).length,1);
});

test('Finished targets stay as same person and sort below active S-A-B-C', () => {
  const a=make('crm:sortA001','予定','S','SCHEDULED');
  const b=make('crm:sortB001','面会済','S','MET');
  const c=make('crm:sortC001','その他','B','WISH');
  assert.deepEqual(meetTargets([b,c,a]).map(c=>c.name),['予定','その他','面会済']);
  assert.equal(MEET_TARGET_STATUS_LABELS.MET,'面会済み');
});

test('Malicious / unsupported Meet Target values are rejected, not silently saved', () => {
  const contact=make('crm:validate01','人物');
  assert.throws(()=>validateCrmContact({...contact,meetTarget:{...contact.meetTarget,priority:'TOP'}}),/crm_invalid_meet_priority/);
  assert.throws(()=>validateCrmContact({...contact,meetTarget:{...contact.meetTarget,status:'FOLLOWING'}}),/crm_invalid_meet_status/);
  assert.throws(()=>validateCrmContact({...contact,meetTarget:{...contact.meetTarget,purpose:'x'.repeat(601)}}),/crm_invalid_field:meetPurpose/);
  assert.throws(()=>validateCrmContact({...contact,meetTarget:{...contact.meetTarget,secret:'token'}}),/crm_unknown_meet_target_field/);
  assert.throws(()=>validateCrmContact({...contact,meetTarget:{...contact.meetTarget,introductionVia:'\n'}}),/crm_invalid_field:meetIntroductionVia/);
  assert.throws(()=>validateCrmContact({...contact,referenceUrl:'javascript:alert(1)'}),/crm_invalid_reference_url/);
});

test('Dashboard Meet Target route reuses existing authenticated CRM board and is discoverable',()=>{
  const page=readFileSync(new URL('../src/pages/dashboard/meet-targets.astro',import.meta.url),'utf8');
  const component=readFileSync(new URL('../src/components/dashboard/MeetTargets.tsx',import.meta.url),'utf8');
  const catalog=readFileSync(new URL('../src/data/dashboardAppCatalog.ts',import.meta.url),'utf8');
  const graph=readFileSync(new URL('../src/pages/dashboard/graph.astro',import.meta.url),'utf8');
  assert.match(page,/DashboardLayout/);
  assert.match(page,/MeetTargets client:only="react"/);
  assert.match(catalog,/"id": "meet-targets"/);
  assert.match(catalog,/"href": "\/dashboard\/meet-targets"/);
  assert.match(graph,/href="\/dashboard\/meet-targets"/);
  assert.match(component,/\/api\/dashboard\/board\?scene=crm/);
  assert.match(component,/expectedRevision:revision/);
  assert.match(component,/upsertCrmContact\(snapshot,contact\)/);
  assert.doesNotMatch(component,/localStorage|sessionStorage|\/api\/x-harness|\/api\/line-harness/);
  assert.doesNotMatch(component,/supabase\.from\(|SUPABASE_SERVICE_ROLE_KEY|auto.?DM/i);
});
