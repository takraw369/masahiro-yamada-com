import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Tldraw,
  createShapeId,
  type Editor,
  type TLShape,
  HTMLContainer,
  ShapeUtil,
  Rectangle2d,
  type TLBaseShape,
  T,
} from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { INITIAL_NODES } from '../../../lib/atlas/nodes';
import { getDifficultyColor, getGlowStyle } from '../../../lib/atlas/colorUtils';
import type { AtlasNode } from '../../../lib/atlas/types';

// --- Shape type ---
type AceNodeProps = {
  nodeId: string;
  title: string;
  excerpt: string;
  tags: string[];
  axes: Record<string, number>;
  w: number;
  h: number;
};
type AceNodeShape = TLBaseShape<'ace-node', AceNodeProps>;

// --- ShapeUtil ---
class AceNodeShapeUtil extends ShapeUtil<AceNodeShape> {
  static override type = 'ace-node' as const;
  static override props = {
    nodeId: T.string,
    title: T.string,
    excerpt: T.string,
    tags: T.arrayOf(T.string),
    axes: T.dict(T.number),
    w: T.number,
    h: T.number,
  };

  override getDefaultProps(): AceNodeProps {
    return {
      nodeId: '',
      title: '',
      excerpt: '',
      tags: [],
      axes: {},
      w: 280,
      h: 200,
    };
  }

  override getGeometry(shape: AceNodeShape) {
    return new Rectangle2d({ width: shape.props.w, height: shape.props.h, isFilled: true });
  }

  override component(shape: AceNodeShape) {
    const { title, excerpt, tags, axes } = shape.props;
    const difficulty = axes['難易度'] ?? 0.5;
    const uniqueness = axes['唯一性'] ?? 0.5;
    const color = getDifficultyColor(difficulty);
    const glow = getGlowStyle(uniqueness);

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          background: '#0f1428',
          border: `1px solid ${color}`,
          boxShadow: glow,
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          fontFamily: "'Zen Kaku Gothic New', sans-serif",
          overflow: 'hidden',
          cursor: 'pointer',
        }}
      >
        <div style={{ fontSize: '0.7rem', color, letterSpacing: '0.1em', fontFamily: 'Cormorant Garamond, serif' }}>
          {tags[0] ?? ''}
        </div>
        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f5f1e8', lineHeight: 1.3 }}>
          {title}
        </div>
        <div style={{ fontSize: '0.78rem', color: '#a89e8f', lineHeight: 1.5, flex: 1 }}>
          {excerpt}
        </div>
        {/* 7軸ミニバー */}
        <div style={{ display: 'flex', gap: '2px', marginTop: 'auto' }}>
          {Object.entries(axes).map(([k, v]) => (
            <div
              key={k}
              title={`${k}: ${v}`}
              style={{
                flex: 1,
                height: '3px',
                background: `rgba(212, 169, 67, ${v})`,
                borderRadius: '1px',
              }}
            />
          ))}
        </div>
      </HTMLContainer>
    );
  }

  override indicator(shape: AceNodeShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }
}

const customShapes = [AceNodeShapeUtil];

// --- Atlas component ---
export default function Atlas() {
  const editorRef = useRef<Editor | null>(null);
  const [selected, setSelected] = useState<AtlasNode | null>(null);

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // 既存シェイプをクリア
    const existing = editor.getCurrentPageShapes();
    if (existing.length === 0) {
      // ノードを配置
      const shapes = INITIAL_NODES.map((node) => ({
        id: createShapeId(node.id),
        type: 'ace-node' as const,
        x: node.position?.x ?? 0,
        y: node.position?.y ?? 0,
        props: {
          nodeId: node.id,
          title: node.title,
          excerpt: node.excerpt,
          tags: node.tags,
          axes: node.axes as Record<string, number>,
          w: 280,
          h: 200,
        },
      }));
      editor.createShapes(shapes);
    }

    // 選択変更で詳細パネル更新
    editor.on('change', () => {
      const sel = editor.getSelectedShapes();
      if (sel.length === 1 && sel[0].type === 'ace-node') {
        const shape = sel[0] as AceNodeShape;
        const node = INITIAL_NODES.find((n) => n.id === shape.props.nodeId) ?? null;
        setSelected(node);
      } else {
        setSelected(null);
      }
    });

    // 全体を画面に収める
    setTimeout(() => editor.zoomToFit({ animation: { duration: 400 } }), 100);
  }, []);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <Tldraw
        shapeUtils={customShapes}
        onMount={handleMount}
        hideUi={false}
      />

      {/* 詳細パネル */}
      {selected && (
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            width: '300px',
            background: '#0a0e1f',
            border: '1px solid rgba(212,169,67,0.3)',
            padding: '1.5rem',
            fontFamily: "'Zen Kaku Gothic New', sans-serif",
            color: '#f5f1e8',
            zIndex: 1000,
          }}
        >
          <button
            onClick={() => setSelected(null)}
            style={{ float: 'right', background: 'none', border: 'none', color: '#a89e8f', cursor: 'pointer', fontSize: '1rem' }}
          >
            ✕
          </button>
          <div style={{ fontSize: '0.7rem', color: '#d4a943', letterSpacing: '0.15em', marginBottom: '0.5rem' }}>
            {selected.tags.join(' · ')}
          </div>
          <h2 style={{ fontSize: '1.1rem', margin: '0 0 1rem', lineHeight: 1.3 }}>{selected.title}</h2>
          <p style={{ fontSize: '0.85rem', color: '#a89e8f', lineHeight: 1.7, margin: '0 0 1.5rem' }}>
            {selected.excerpt}
          </p>
          {/* 7軸 */}
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {Object.entries(selected.axes).map(([k, v]) => (
              <div key={k} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 30px', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: '#a89e8f' }}>{k}</span>
                <div style={{ height: '4px', background: '#1a2040', borderRadius: '2px' }}>
                  <div style={{ height: '100%', width: `${(v as number) * 100}%`, background: '#d4a943', borderRadius: '2px' }} />
                </div>
                <span style={{ fontSize: '0.7rem', color: '#d4a943', textAlign: 'right' }}>{Math.round((v as number) * 100)}</span>
              </div>
            ))}
          </div>
          {selected.obsidianPath && (
            <a
              href={`obsidian://open?vault=ace-vault&file=${encodeURIComponent(selected.obsidianPath)}`}
              style={{ display: 'block', marginTop: '1.5rem', fontSize: '0.75rem', color: '#d4a943', textDecoration: 'none', letterSpacing: '0.1em' }}
            >
              → OBSIDIANで開く
            </a>
          )}
        </div>
      )}
    </div>
  );
}
