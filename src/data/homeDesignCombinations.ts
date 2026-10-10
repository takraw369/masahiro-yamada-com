import { HOME_PRESET_STORAGE_KEY, homeDesignPresets, isHomeDesignPreset, type HomeDesignPresetId } from './homeDesignPresets';

export const HOME_DESIGN_STORAGE_KEY = 'masa.dashboard.home.design-composition.v2';
export const HOME_DESIGN_FAVORITES_KEY = 'masa.dashboard.home.design-favorites.v1';

export const homeLayoutPresets = [
  { id:'focus', name:'Focus First', description:'今日の一手から始める、縦に流れる構成。' },
  { id:'split', name:'Command Split', description:'行動を左に、商品・収益を右に置く二分割。' },
  { id:'journey', name:'Journey First', description:'活動の流れを最初に示してから実行へ。' },
  { id:'tiles', name:'Action Tiles', description:'発信・行動への導線を先に出すカード主導型。' },
  { id:'editorial', name:'Editorial Story', description:'流れと発信を並べ、考えから行動へ導く。' },
  { id:'studio', name:'Studio Grid', description:'実行の下に収益・流れ・発信を並列整理。' },
] as const;

export const homeComponentPresets = {
  buttons: [
    { id:'sharp', name:'Sharp', description:'角を立て、判断を明確に' },
    { id:'soft', name:'Soft', description:'角丸と余白で穏やかに' },
    { id:'pill', name:'Pill', description:'丸みを強めて軽快に' },
  ],
  cards: [
    { id:'outline', name:'Outline', description:'細い輪郭で情報を整理' },
    { id:'soft', name:'Soft Surface', description:'柔らかい面でまとめる' },
    { id:'float', name:'Floating', description:'影と浮遊感で階層化' },
  ],
  navigation: [
    { id:'tabs', name:'Tabs', description:'横並びで行き先を比較' },
    { id:'chips', name:'Chips', description:'小さな選択肢を並べる' },
    { id:'dock', name:'Dock', description:'手元にまとまる4アクション' },
  ],
  cta: [
    { id:'solid', name:'Solid', description:'ひとつの行動を強調' },
    { id:'outline', name:'Outline', description:'控えめな線で誘導' },
    { id:'minimal', name:'Text + Arrow', description:'文章と矢印を主役に' },
  ],
} as const;

export type HomeLayoutId = (typeof homeLayoutPresets)[number]['id'];
export type HomeButtonId = (typeof homeComponentPresets.buttons)[number]['id'];
export type HomeCardId = (typeof homeComponentPresets.cards)[number]['id'];
export type HomeNavigationId = (typeof homeComponentPresets.navigation)[number]['id'];
export type HomeCtaId = (typeof homeComponentPresets.cta)[number]['id'];

export type HomeDesignConfig = {
  version:2;
  style:HomeDesignPresetId;
  layout:HomeLayoutId;
  buttons:HomeButtonId;
  cards:HomeCardId;
  navigation:HomeNavigationId;
  cta:HomeCtaId;
};

export const DEFAULT_HOME_DESIGN: HomeDesignConfig = {
  version:2,
  style:'dawn',
  layout:'focus',
  buttons:'soft',
  cards:'soft',
  navigation:'tabs',
  cta:'solid',
};

export const isHomeLayoutId = (value:unknown):value is HomeLayoutId => typeof value === 'string' && homeLayoutPresets.some(item=>item.id===value);
export const isHomeComponentId = <K extends keyof typeof homeComponentPresets>(category:K, value:unknown):value is (typeof homeComponentPresets)[K][number]['id'] =>
  typeof value === 'string' && homeComponentPresets[category].some(item => item.id === value);

export function isHomeDesignConfig(value:unknown):value is HomeDesignConfig {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string,unknown>;
  return item.version === 2
    && isHomeDesignPreset(item.style)
    && isHomeLayoutId(item.layout)
    && isHomeComponentId('buttons',item.buttons)
    && isHomeComponentId('cards',item.cards)
    && isHomeComponentId('navigation',item.navigation)
    && isHomeComponentId('cta',item.cta);
}

export function parseHomeDesign(raw:string|null, legacyRaw:string|null = null):HomeDesignConfig|null {
  if (raw !== null) {
    try {
      const parsed:unknown = JSON.parse(raw);
      if (isHomeDesignConfig(parsed)) {
        const { style,layout,buttons,cards,navigation,cta } = parsed;
        return {version:2,style,layout,buttons,cards,navigation,cta};
      }
    } catch { /* invalid JSON is ignored */ }
    return null; // Corrupt v2 never falls back to old v1.
  }
  if (isHomeDesignPreset(legacyRaw)) return {...DEFAULT_HOME_DESIGN,style:legacyRaw};
  return null;
}

export function loadHomeDesign(storage:Pick<Storage,'getItem'>):HomeDesignConfig|null {
  return parseHomeDesign(storage.getItem(HOME_DESIGN_STORAGE_KEY),storage.getItem(HOME_PRESET_STORAGE_KEY));
}

export function writeHomeDesign(storage:Pick<Storage,'setItem'>, config:HomeDesignConfig):void {
  if (!isHomeDesignConfig(config)) throw new Error('invalid_home_design');
  storage.setItem(HOME_DESIGN_STORAGE_KEY,JSON.stringify(config));
}

export function resetHomeDesign(storage:Pick<Storage,'removeItem'>):void {
  storage.removeItem(HOME_DESIGN_STORAGE_KEY);
  storage.removeItem(HOME_PRESET_STORAGE_KEY);
}

export function describeHomeDesign(config:HomeDesignConfig):string {
  const style = homeDesignPresets.find(item => item.id === config.style)?.name ?? config.style;
  const layout = homeLayoutPresets.find(item => item.id === config.layout)?.name ?? config.layout;
  return `${style} / ${layout}`;
}
