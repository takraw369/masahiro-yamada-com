import { isHomeDesignConfig, parseHomeDesign, HOME_DESIGN_FAVORITES_KEY, type HomeDesignConfig } from './homeDesignCombinations';
import { DASHBOARD_REFERENCE_STORAGE_KEY, parseDashboardReferenceState, type DashboardReferenceState } from './dashboardDesignReferences';

export const DESIGN_DRAFT_KEY = 'masa.dashboard.design-draft.v1';
export const DESIGN_IMPORT_BACKUP_KEY = 'masa.dashboard.design-import-backup.v1';
export type DesignFavorite = {id:string;name:string;config:HomeDesignConfig};
export type DashboardDesignSnapshot = {version:1;references:DashboardReferenceState;draft:HomeDesignConfig;favorites:DesignFavorite[]};
export type SharedDesign = {snapshot:DashboardDesignSnapshot|null;revision:number;updatedAt:string|null};

export function parseDesignFavorites(value:unknown):DesignFavorite[] {
  if (!Array.isArray(value)) return [];
  const seen=new Set<string>();
  return value.slice(0,12).filter((item):item is DesignFavorite=>{
    if (!item || typeof item!=='object' || typeof item.id!=='string' || !item.id || item.id.length>=60
      || seen.has(item.id) || typeof item.name!=='string' || !item.name.trim() || item.name.length>48
      || !isHomeDesignConfig(item.config)) return false;
    seen.add(item.id);return true;
  }).map(item=>({id:item.id,name:item.name,config:parseHomeDesign(JSON.stringify(item.config))!}));
}

export function parseDesignSnapshot(value:unknown):DashboardDesignSnapshot|null {
  if (!value || typeof value!=='object' || Array.isArray(value)) return null;
  const item=value as Record<string,unknown>;
  if (item.version!==1 || !isHomeDesignConfig(item.draft) || !Array.isArray(item.favorites)
    || !item.references || typeof item.references!=='object' || Array.isArray(item.references)
    || (item.references as Record<string,unknown>).version!==1) return null;
  return {version:1,draft:parseHomeDesign(JSON.stringify(item.draft))!,
    references:parseDashboardReferenceState(JSON.stringify(item.references)),favorites:parseDesignFavorites(item.favorites)};
}

export function readDesignBackup(raw:string|null):DashboardDesignSnapshot|null {
  if (!raw || raw.length>32000) return null;
  try {return parseDesignSnapshot(JSON.parse(raw));} catch {return null;}
}

// Applied home keys are deliberately excluded. Roll back a partial local write.
export function importDesignSnapshot(storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>,
  incoming:DashboardDesignSnapshot,current:DashboardDesignSnapshot):DashboardDesignSnapshot {
  const snapshot=parseDesignSnapshot(incoming),backup=parseDesignSnapshot(current);
  if (!snapshot || !backup) throw new Error('invalid_design_snapshot');
  const writes:[string,string][]=[
    [DESIGN_IMPORT_BACKUP_KEY,JSON.stringify(backup)],
    [DASHBOARD_REFERENCE_STORAGE_KEY,JSON.stringify(snapshot.references)],
    [HOME_DESIGN_FAVORITES_KEY,JSON.stringify(snapshot.favorites)],
    [DESIGN_DRAFT_KEY,JSON.stringify(snapshot.draft)],
  ];
  const previous=writes.map(([key])=>[key,storage.getItem(key)] as const);
  try {for(const [key,value] of writes) storage.setItem(key,value);}
  catch(error) {
    for(const [key,value] of previous) {
      try {if(value===null)storage.removeItem(key);else storage.setItem(key,value);} catch {/* UI also reports the failure. */}
    }
    throw error;
  }
  return snapshot;
}

export function parseSharedDesign(value:unknown):SharedDesign|null {
  if (!value || typeof value!=='object') return null;
  const item=value as Record<string,unknown>;
  if (!Number.isSafeInteger(item.revision) || Number(item.revision)<0 || Number(item.revision)>2147483647) return null;
  const snapshot=parseDesignSnapshot(item.snapshot);
  if ((item.revision===0 && item.snapshot!==null) || (item.revision!==0 && !snapshot)) return null;
  if (item.updatedAt!==null && (typeof item.updatedAt!=='string' || Number.isNaN(Date.parse(item.updatedAt)))) return null;
  return {revision:Number(item.revision),snapshot,updatedAt:item.updatedAt as string|null};
}
