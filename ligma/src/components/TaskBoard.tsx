import React from 'react';
import { ArrowRight, Brain, CheckCircle2, CircleHelp, ClipboardCheck, Inbox, Link2, Sparkles } from 'lucide-react';
import type { Task } from '../state/types';

const INTENT_LABELS: Record<string, string> = {
  action_item: 'Action Items',
  decision: 'Decisions',
  open_question: 'Open Questions',
  reference: 'References',
};

const INTENT_META = {
  action_item: { Icon: ClipboardCheck, color: '#c94040' },
  decision: { Icon: CheckCircle2, color: '#1f9060' },
  open_question: { Icon: CircleHelp, color: '#a86800' },
  reference: { Icon: Link2, color: '#1a6fa8' },
} satisfies Record<string, { Icon: typeof ClipboardCheck; color: string }>;

function fmt(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch { return ''; }
}

interface Props {
  tasks: Task[];
  onNodeFocus?: (nodeId: string) => void;
}

export default function TaskBoard({ tasks, onNodeFocus }: Props) {
  if (!tasks.length) {
    return (
      <div className="empty-state">
        <Brain className="empty-icon-svg" />
        <strong>No tasks yet.</strong>
        <div style={{ marginTop: 6 }}>Start writing on sticky notes - AI will classify them automatically.</div>
      </div>
    );
  }

  const groups: Record<string, Task[]> = {};
  for (const t of tasks) (groups[t.intent_type] ??= []).push(t);
  const ORDER = ['action_item', 'decision', 'open_question', 'reference'];

  return (
    <div className="task-list">
      {ORDER.filter((k) => groups[k]?.length).map((intent) => {
        const meta = INTENT_META[intent] ?? { Icon: Inbox, color: '#64748b' };
        const Icon = meta.Icon;
        return (
          <div key={intent} className="sidebar-section">
            <div className="sidebar-section-title">
              <Icon size={13} /> {INTENT_LABELS[intent]} ({groups[intent]!.length})
            </div>
            {groups[intent]!.map((t) => (
              <div
                key={t.id}
                className="task-card"
                data-testid="task-card"
                data-node-id={t.node_id}
                style={{ borderLeft: `3px solid ${meta.color}`, cursor: onNodeFocus ? 'pointer' : 'default' }}
                onClick={() => onNodeFocus?.(t.node_id)}
                title={onNodeFocus ? 'Click to focus on canvas node' : undefined}
              >
                <div className="task-card-header">
                  {t.confirmed_by_ai && (
                    <span className="ai-chip"><Sparkles size={10} /> AI verified</span>
                  )}
                </div>
                <div className="task-title">{t.title}</div>
                <div className="task-meta" style={{ marginTop: 6 }}>
                  {t.author_color && <div className="task-dot" style={{ background: t.author_color }} />}
                  {t.author_name && <span style={{ fontSize: 11, color: 'var(--text-sub)' }}>{t.author_name}</span>}
                  <span className="task-time">{fmt(t.updated_at)}</span>
                  {onNodeFocus && (
                    <span style={{ fontSize: 10, color: 'var(--accent)', marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 2 }}>
                      focus <ArrowRight size={10} />
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
