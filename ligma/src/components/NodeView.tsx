import React, { useRef, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Lock, Sparkles, Trash2 } from 'lucide-react';
import type { CanvasNode } from '../state/types';

function intentLabel(intent: string | null | undefined): string {
  if (!intent) return '';
  return { action_item: 'Action', decision: 'Decision', open_question: 'Question', reference: 'Ref' }[intent] ?? intent;
}

interface Props {
  node: CanvasNode;
  selected: boolean;
  canEdit: boolean;
  zoom: number;
  onPointerDown: (e: React.PointerEvent) => void;
  onResizeStart: (e: React.PointerEvent) => void;
  onTextChange: (text: string) => void;
  onDelete: () => void;
  onLock: (role: string | null) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

// ── Shape SVG renderer ────────────────────────────────────────────────────────
function ShapeSVG({ node, selected }: { node: CanvasNode; selected: boolean }) {
  const { kind, color, w, h } = node;
  const stroke = selected ? 'var(--accent)' : color;
  const strokeW = selected ? 2.5 : 2;
  const fill = `${color}22`;

  switch (kind) {
    case 'circle': {
      return (
        <svg width={w} height={h} style={{ display: 'block', overflow: 'visible', position: 'absolute', inset: 0 }}>
          <ellipse cx={w / 2} cy={h / 2} rx={w / 2 - 4} ry={h / 2 - 4}
            fill={fill} stroke={stroke} strokeWidth={strokeW} />
        </svg>
      );
    }
    case 'diamond': {
      const pts = `${w / 2},4 ${w - 4},${h / 2} ${w / 2},${h - 4} 4,${h / 2}`;
      return (
        <svg width={w} height={h} style={{ display: 'block', overflow: 'visible', position: 'absolute', inset: 0 }}>
          <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
        </svg>
      );
    }
    case 'triangle': {
      const pts = `${w / 2},4 ${w - 4},${h - 4} 4,${h - 4}`;
      return (
        <svg width={w} height={h} style={{ display: 'block', overflow: 'visible', position: 'absolute', inset: 0 }}>
          <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
        </svg>
      );
    }
    case 'hexagon': {
      const hw = w / 4, hh = h / 2;
      const pts = `${hw},4 ${w - hw},4 ${w - 4},${hh} ${w - hw},${h - 4} ${hw},${h - 4} 4,${hh}`;
      return (
        <svg width={w} height={h} style={{ display: 'block', overflow: 'visible', position: 'absolute', inset: 0 }}>
          <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
        </svg>
      );
    }
    case 'star': {
      const cx = w / 2, cy = h / 2;
      const or = Math.min(w, h) / 2 - 4;
      const ir = or * 0.4;
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 === 0 ? or : ir;
        const angle = (i * 36 - 90) * Math.PI / 180;
        return `${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`;
      }).join(' ');
      return (
        <svg width={w} height={h} style={{ display: 'block', overflow: 'visible', position: 'absolute', inset: 0 }}>
          <polygon points={pts} fill={fill} stroke={stroke} strokeWidth={strokeW} strokeLinejoin="round" />
        </svg>
      );
    }
    case 'arrow': {
      return (
        <svg width={w} height={h} style={{ display: 'block', overflow: 'visible', position: 'absolute', inset: 0 }}>
          <defs>
            <marker id={`ah-${node.id}`} markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill={stroke} />
            </marker>
          </defs>
          <line x1="4" y1={h / 2} x2={w - 20} y2={h / 2}
            stroke={stroke} strokeWidth={strokeW} strokeLinecap="round"
            markerEnd={`url(#ah-${node.id})`} />
        </svg>
      );
    }
    default:
      return null;
  }
}

// ── Draw node ─────────────────────────────────────────────────────────────────
function DrawNode({ node, selected, onPointerDown, onDelete, canEdit }: {
  node: CanvasNode; selected: boolean; canEdit: boolean;
  onPointerDown: (e: React.PointerEvent) => void; onDelete: () => void;
}) {
  if (!node.points?.length) return null;
  const xs = node.points.map(([x]) => x);
  const ys = node.points.map(([, y]) => y);
  const minX = Math.min(...xs), minY = Math.min(...ys);
  const pts = node.points.map(([x, y]) => `${x - minX},${y - minY}`).join(' ');

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      className={`canvas-node${selected ? ' selected' : ''}`}
      style={{
        left: node.x, top: node.y, width: node.w, height: node.h,
        background: 'transparent', border: selected ? '1.5px dashed var(--accent)' : '1.5px dashed transparent',
        boxShadow: 'none', cursor: 'move',
      }}
      onPointerDown={onPointerDown}
    >
      <svg width={node.w} height={node.h} style={{ display: 'block' }}>
        <polyline points={pts} fill="none" stroke={node.color} strokeWidth={2.5}
          strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {canEdit && selected && (
        <button
          className="node-action danger"
          style={{ position: 'absolute', top: -12, right: -12, opacity: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', width: 20, height: 20, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <X size={10} />
        </button>
      )}
    </motion.div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function NodeView({ node, selected, canEdit, zoom: _zoom, onPointerDown, onResizeStart, onTextChange, onDelete, onLock: _onLock, onContextMenu }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);

  if (node.kind === 'draw') {
    return (
      <DrawNode node={node} selected={selected} canEdit={canEdit}
        onPointerDown={onPointerDown} onDelete={onDelete} />
    );
  }

  if (node.kind === 'edge') return null;

  const editable = canEdit && !node.lockedToRole;
  const isShape = ['circle', 'diamond', 'triangle', 'hexagon', 'star', 'arrow'].includes(node.kind);

  // Shape nodes — no text, just the SVG shape
  if (isShape) {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.85, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.7, filter: 'blur(4px)' }}
      transition={{ type: 'spring', damping: 20, stiffness: 250 }}
      className={`canvas-node${selected ? ' selected' : ''}`}
      data-testid="canvas-node"
      data-node-id={node.id}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h, background: 'transparent', border: 'none', boxShadow: 'none' }}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      >
        <ShapeSVG node={node} selected={selected} />
        {editable && (
          <>
            <div className="resize-handle" onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e); }} />
            <button
              className="node-action danger"
              style={{ position: 'absolute', top: -12, right: -12, opacity: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '50%', width: 20, height: 20, fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <X size={10} />
            </button>
          </>
        )}
      </motion.div>
    );
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!bodyRef.current) return;
    const el = bodyRef.current;
    if (document.activeElement !== el && el.innerText !== (node.text ?? '')) {
      el.innerText = node.text ?? '';
    }
  }, [node.text]);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const handleInput = useCallback(() => {
    if (bodyRef.current) onTextChange(bodyRef.current.innerText);
  }, [onTextChange]);

  const accentColor = node.color || '#5b6af7';
  const intentClass = node.intent ? `intent-${node.intent}` : '';

  return (
    <motion.div
      layoutId={node.id}
      initial={{ opacity: 0, scale: 0.85, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.7, filter: 'blur(4px)' }}
      transition={{ type: 'spring', damping: 20, stiffness: 250 }}
      className={`canvas-node${selected ? ' selected' : ''}${node.lockedToRole ? ' locked' : ''}`}
      data-testid="canvas-node"
      data-node-id={node.id}
      style={{ left: node.x, top: node.y, width: node.w, height: node.h }}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
    >
      <div style={{ height: 4, background: accentColor, borderRadius: '10px 10px 0 0', flexShrink: 0 }} />

      {(node.intent || node.lockedToRole) && (
        <div className="node-header">
          {node.intent && (
            <span className={`node-intent-badge ${intentClass}`}>
              {node.intentSource === 'ai' && <Sparkles size={10} style={{ marginRight: 4 }} />}
              {intentLabel(node.intent)}
            </span>
          )}
          {node.lockedToRole && <span className="node-lock"><Lock size={10} style={{ marginRight: 2 }} /> {node.lockedToRole}</span>}
        </div>
      )}

      <div
        ref={bodyRef}
        className="node-body"
        contentEditable={editable ? 'true' : 'false'}
        suppressContentEditableWarning
        data-placeholder={node.kind === 'text' ? 'Text…' : 'Type here…'}
        onInput={handleInput}
        onPointerDown={(e) => { if (editable) e.stopPropagation(); }}
        style={node.kind === 'text' ? { fontWeight: 500, fontSize: 15 } : undefined}
      />

      <div className="node-footer">
        {editable && (
          <button className="node-action danger" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {editable && (
        <div className="resize-handle" onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e); }} />
      )}
    </motion.div>
  );
}
