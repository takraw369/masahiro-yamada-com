export type LineRichMenuAction =
  | { type: 'uri'; label: string; uri: string }
  | { type: 'message'; label: string; text: string };

export type LineRichMenuArea = {
  id: 'flow-check' | 'quest' | 'tips' | 'consult';
  title: string;
  eyebrow: string;
  bounds: { x: number; y: number; width: number; height: number };
  action: LineRichMenuAction;
};

export const SLF_FIELD_MAP_SIZE = { width: 2500, height: 1686 } as const;

/**
 * Stage 0 / EXPLORE rich-menu candidate.
 *
 * Design rule:
 * - one visual world, not four equal cards
 * - one hero action first, secondary routes below
 * - no production activation from this module
 */
export const SLF_FIELD_MAP_AREAS: LineRichMenuArea[] = [
  {
    id: 'flow-check',
    eyebrow: 'DISCOVERY',
    title: '自分を知る',
    bounds: { x: 0, y: 160, width: 2500, height: 630 },
    action: {
      type: 'uri',
      label: 'FLOW CHECK',
      uri: 'https://sunlovesflow.com/flow-check.html',
    },
  },
  {
    id: 'quest',
    eyebrow: 'QUEST',
    title: 'やってみる',
    bounds: { x: 0, y: 790, width: 833, height: 896 },
    action: {
      type: 'uri',
      label: 'QUEST',
      uri: 'https://sunlovesflow.com/quest/want-return/',
    },
  },
  {
    id: 'tips',
    eyebrow: 'LEARN',
    title: '知ってみる',
    bounds: { x: 833, y: 790, width: 834, height: 896 },
    action: {
      type: 'uri',
      label: 'ACE TIPS',
      uri: 'https://sunlovesflow.com/library/',
    },
  },
  {
    id: 'consult',
    eyebrow: 'DIALOGUE',
    title: '話してみる',
    bounds: { x: 1667, y: 790, width: 833, height: 896 },
    action: {
      type: 'message',
      label: 'MASAに相談',
      text: 'MASAに相談したい',
    },
  },
];

export const SLF_FIELD_MAP_RICH_MENU_CANDIDATE = {
  size: SLF_FIELD_MAP_SIZE,
  selected: true,
  name: 'SLF FIELD MAP｜Stage 0 EXPLORE',
  chatBarText: 'FIELD MAP',
  areas: SLF_FIELD_MAP_AREAS.map(({ bounds, action }) => ({ bounds, action })),
} as const;
