import {
  createCrmContact, type CrmContact, type MeetTargetMeta,
  type MeetTargetPriority, type MeetTargetStatus,
} from './crm';

export const MEET_TARGET_STATUS_LABELS: Record<MeetTargetStatus,string> = {
  WISH: '未接点',
  ROUTE_FOUND: '紹介経路候補',
  INTRO_REQUESTED: '紹介依頼中',
  CONTACTED: '連絡済み',
  SCHEDULED: '面会予定',
  MET: '面会済み',
  PAUSED: '保留',
};
export const MEET_TARGET_PRIORITY_LABELS: Record<MeetTargetPriority,string> = {
  S:'S · 最優先', A:'A · 高', B:'B · 中', C:'C · いつか',
};
export function isMeetTarget(contact: CrmContact): boolean {
  return contact.meetTarget?.version === 1;
}
export function meetTargets(contacts:CrmContact[]):CrmContact[] {
  const order:Record<MeetTargetPriority,number> = { S:0,A:1,B:2,C:3 };
  return contacts.filter(isMeetTarget).sort((a,b)=>{
    const aDone=a.meetTarget!.status==='MET'||a.meetTarget!.status==='PAUSED';
    const bDone=b.meetTarget!.status==='MET'||b.meetTarget!.status==='PAUSED';
    if(aDone!==bDone)return Number(aDone)-Number(bDone);
    return order[a.meetTarget!.priority]-order[b.meetTarget!.priority]
      || (a.nextAt||'9999-99-99').localeCompare(b.nextAt||'9999-99-99')
      || b.updatedAt.localeCompare(a.updatedAt);
  });
}
export function newMeetTarget(id:string, now=new Date()):CrmContact {
  return {
    ...createCrmContact(id,now),
    source:'meet-target-v1',
    relation:'会いたい人物',
    meetTarget:{version:1,priority:'A',status:'WISH',purpose:'',introductionVia:''},
  };
}
export function mergeMeetTarget(contact:CrmContact, input:{
  priority:MeetTargetPriority;status:MeetTargetStatus;purpose:string;introductionVia:string;
  name:string;organization:string;role:string;referenceUrl:string;tags:string[];
  nextAction:string;nextAt:string;
},now=new Date()):CrmContact {
  const meetTarget:MeetTargetMeta={
    version:1,
    priority:input.priority,
    status:input.status,
    purpose:input.purpose.trim(),
    introductionVia:input.introductionVia.trim(),
  };
  return {
    ...contact,
    name:input.name.trim(),
    organization:input.organization.trim(),
    role:input.role.trim(),
    referenceUrl:input.referenceUrl.trim(),
    tags:[...new Set(input.tags.map(t=>t.trim()).filter(Boolean))],
    nextAction:input.nextAction.trim(),
    nextAt:input.nextAt,
    meetTarget,
    updatedAt:now.toISOString(),
  };
}
