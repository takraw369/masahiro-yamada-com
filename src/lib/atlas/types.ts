export interface AtlasAxes {
  社会性: number;
  情熱度: number;
  収益性: number;
  難易度: number;
  持続性: number;
  公開性: number;
  唯一性: number;
}

export interface AtlasNode {
  id: string;
  title: string;
  excerpt: string;
  tags: string[];
  axes: Partial<AtlasAxes>;
  parent?: string;
  children: string[];
  coverImage?: string;
  obsidianPath?: string;
  position?: { x: number; y: number };
  bodyHtml?: string;
}

export interface AtlasLayout {
  version: number;
  updated: string;
  positions: Record<string, { x: number; y: number }>;
}
