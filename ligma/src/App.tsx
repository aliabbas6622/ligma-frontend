import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { OTClient } from './state/ot-client';
import type { CanvasNode, Role, Task, EventRow, HeatmapData } from './state/types';
import { api } from './state/api';
import Canvas from './components/Canvas';
import TaskBoard from './components/TaskBoard';
import EventLog from './components/EventLog';
import ReplayBar from './components/ReplayBar';
import {
  Activity,
  ArrowRight,
  Ban,
  Brain,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  ClipboardList,
  Copy,
  Crown,
  Download,
  Eye,
  FileText,
  Flame,
  Inbox,
  Link2,
  PencilLine,
  Plus,
  Share2,
  Sparkles,
  User,
  Users,
  X,
} from 'lucide-react';

const SWATCHES = ['#5b6af7', '#e05050', '#31a76c', '#d4880a', '#2c8fd4', '#a855f7', '#ec4899'];
const DEFAULT_SESSION = '00000000-0000-0000-0000-000000000001';
const DEFAULT_PAGE_ID = 'page-1';
const PAGE_STORAGE_KEY = `ligma.pages.${DEFAULT_SESSION}`;

interface SummaryItem { text: string; author?: string; nodeId: string; timestamp: string }
interface SummarySection { title: string; items: SummaryItem[] }
interface SessionSummary {
  sessionName: string;
  generatedAt: string;
  totalNodes: number;
  totalEvents: number;
  sections: {
    decisions: SummarySection;
    action_items: SummarySection;
    open_questions: SummarySection;
    references: SummarySection;
  };
  aiNarrative: string | null;
  source: 'ai' | 'structured';
}

interface JoinInfo { name: string; role: Role; color: string; userId: string }
interface CanvasPage { id: string; name: string; createdAt: number }

function readInitialPageId(): string {
  if (typeof window === 'undefined') return DEFAULT_PAGE_ID;
  const page = new URLSearchParams(window.location.search).get('page')?.trim();
  return page || DEFAULT_PAGE_ID;
}

function readStoredPages(activePageId: string): CanvasPage[] {
  const fallback = [{ id: DEFAULT_PAGE_ID, name: 'Page 1', createdAt: 1 }];
  if (typeof window === 'undefined') return fallback;

  try {
    const raw = window.localStorage.getItem(PAGE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as CanvasPage[] : fallback;
    const pages = Array.isArray(parsed) && parsed.length ? parsed : fallback;
    if (pages.some((page) => page.id === activePageId)) return pages;
    return [...pages, { id: activePageId, name: 'Shared page', createdAt: Date.now() }];
  } catch {
    return activePageId === DEFAULT_PAGE_ID
      ? fallback
      : [...fallback, { id: activePageId, name: 'Shared page', createdAt: Date.now() }];
  }
}

function toMarkdown(s: SessionSummary): string {
  const date = new Date(s.generatedAt).toLocaleString();
  const lines: string[] = [
    `# LIGMA Session Brief - ${s.sessionName}`,
    `_Generated ${date} - ${s.totalEvents} events - ${s.source === 'ai' ? 'Gemini 2.0 Flash' : 'structured'}_`,
    '',
  ];

  if (s.aiNarrative) lines.push('## Executive Summary', '', s.aiNarrative, '');

  for (const [, sec] of Object.entries(s.sections) as [string, SummarySection][]) {
    if (!sec.items.length) continue;
    lines.push(`## ${sec.title}`, '');
    for (const item of sec.items) {
      const by = item.author ? ` _(${item.author})_` : '';
      lines.push(`- ${item.text}${by}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function SummaryModal({ onClose }: { onClose: () => void }) {
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const next = await api.summary.get(DEFAULT_SESSION) as SessionSummary;
        if (!cancelled) {
          setSummary(next);
          setLoading(false);
        }
        return;
      } catch (primaryError) {
        if (
          typeof window !== 'undefined' &&
          /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname)
        ) {
          try {
            const res = await fetch(`http://127.0.0.1:18083/api/summary/${DEFAULT_SESSION}`);
            if (!res.ok) throw new Error(`summary fallback failed: ${res.status}`);
            const next = await res.json() as SessionSummary;
            if (!cancelled) {
              setSummary(next);
              setLoading(false);
            }
            return;
          } catch {
            // Fall through to the generic UI error below.
          }
        }

        if (!cancelled) {
          console.error('Summary request failed', primaryError);
          setErr('Failed to generate summary');
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const download = () => {
    if (!summary) return;
    const md = toMarkdown(summary);
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ligma-brief-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <div
        className="dialog"
        style={{ width: 'min(560px, 95vw)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', animation: 'pop-in .2s ease' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div className="dialog-logo dialog-title-row" style={{ fontSize: 22, margin: 0 }}>
            <FileText size={22} /> Session Brief
          </div>
          <div style={{ flex: 1 }} />
          {summary && (
            <button className="btn-join" style={{ width: 'auto', padding: '8px 16px', marginTop: 0, fontSize: 13 }} onClick={download}>
              <Download size={14} /> Download .md
            </button>
          )}
          <button onClick={onClose} className="icon-only-btn" aria-label="Close summary">
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-sub)' }}>
            <Sparkles size={32} style={{ marginBottom: 12, animation: 'pulse 1s infinite', color: 'var(--accent)' }} />
            <div>Gemini 2.0 Flash is generating your brief...</div>
          </div>
        )}
        {err && <div style={{ color: 'var(--danger)', textAlign: 'center', padding: 24 }}>{err}</div>}

        {summary && (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <div style={{ fontSize: 11, color: 'var(--text-sub)', marginBottom: 14 }}>
              {new Date(summary.generatedAt).toLocaleString()} - {summary.totalEvents} events -
              <span style={{ marginLeft: 4, color: summary.source === 'ai' ? 'var(--accent)' : 'var(--text-sub)', fontWeight: 600 }}>
                {summary.source === 'ai' ? 'Gemini-2.0- Flash' : 'Structured fallback'}
              </span>
            </div>

            {summary.aiNarrative && (
              <div style={{ background: 'var(--accent-bg)', border: '1px solid var(--accent-bg2)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={12} /> Executive Summary
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text)' }}>{summary.aiNarrative}</div>
              </div>
            )}

            {([
              ['decisions', CheckCircle2, '#1f9060'],
              ['action_items', ClipboardCheck, '#c94040'],
              ['open_questions', CircleHelp, '#a86800'],
              ['references', Link2, '#1a6fa8'],
            ] as [keyof typeof summary.sections, typeof CheckCircle2, string][]).map(([key, Icon, color]) => {
              const sec = summary.sections[key];
              if (!sec.items.length) return null;
              return (
                <div key={key} style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Icon size={14} /> {sec.title} <span style={{ fontWeight: 400, color: 'var(--text-sub)' }}>({sec.items.length})</span>
                  </div>
                  {sec.items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                      <div style={{ width: 4, background: color, borderRadius: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>{item.text}</div>
                        {item.author && (
                          <div style={{ fontSize: 11, color: 'var(--text-sub)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <User size={11} /> {item.author}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}

            {!summary.aiNarrative && !Object.values(summary.sections).some((s) => s.items.length) && (
              <div className="empty-state">
                <Inbox className="empty-icon-svg" />
                No content yet - add sticky notes to the canvas to generate a brief.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ShareModal({
  url,
  pageName,
  onClose,
}: {
  url: string;
  pageName: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const shareNative = async () => {
    if (!navigator.share) {
      await copyLink();
      return;
    }
    try {
      await navigator.share({
        title: `LIGMA - ${pageName}`,
        text: `Join this LIGMA workspace page: ${pageName}`,
        url,
      });
    } catch {
      // The native sheet was dismissed; keep the dialog open.
    }
  };

  return (
    <div className="overlay" onClick={onClose} style={{ zIndex: 2100 }}>
      <div
        className="dialog share-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-header-row">
          <div>
            <div className="dialog-logo dialog-title-row" style={{ fontSize: 24, margin: 0 }}>
              <Share2 size={22} /> Share workspace
            </div>
            <div className="dialog-sub" style={{ marginBottom: 0 }}>Anyone with access to the app can open this page.</div>
          </div>
          <button onClick={onClose} className="icon-only-btn" aria-label="Close share dialog">
            <X size={18} />
          </button>
        </div>

        <div className="share-url-box">
          <Link2 size={16} />
          <input className="share-url-input" value={url} readOnly onFocus={(e) => e.currentTarget.select()} />
        </div>

        <div className="share-actions">
          <button className="btn-join share-secondary" onClick={copyLink}>
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button className="btn-join" onClick={shareNative}>
            <Share2 size={16} />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

function JoinDialog({ onJoin }: { onJoin: (i: JoinInfo) => void }) {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('Contributor');
  const [color, setColor] = useState(SWATCHES[0]!);
  const [loading, setLoading] = useState(false);

  const join = async () => {
    if (!name.trim() || loading) return;
    setLoading(true);
    let userId: string;
    try {
      const u = await api.users.create(name.trim(), role, color);
      userId = u.id;
    } catch {
      userId = uuidv4();
    }
    onJoin({ name: name.trim(), role, color, userId });
  };

  return (
    <div className="overlay">
      <div className="dialog" style={{ animation: 'pop-in .22s ease' }}>
        <div className="dialog-logo">LIGMA</div>
        <div className="dialog-sub">Let's Integrate Groups, Manage Anything</div>

        <div className="field">
          <label>Your name</label>
          <input
            className="inp"
            placeholder="e.g. Alice"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && join()}
            autoFocus
          />
        </div>

        <div className="field">
          <label>Role</label>
          <div className="role-row">
            {(['Lead', 'Contributor', 'Viewer'] as Role[]).map((r) => (
              <div key={r} className={`role-opt${role === r ? ' sel' : ''}`} onClick={() => setRole(r)}>
                {r === 'Lead' && <Crown size={14} />}
                {r === 'Contributor' && <PencilLine size={14} />}
                {r === 'Viewer' && <Eye size={14} />}
                {r}
              </div>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Colour</label>
          <div className="color-row">
            {SWATCHES.map((c) => (
              <div
                key={c}
                className={`swatch${color === c ? ' sel' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <button className="btn-join" disabled={!name.trim() || loading} onClick={join}>
          {loading ? 'Joining...' : <><span>Join Session</span><ArrowRight size={16} /></>}
        </button>

        <div style={{ marginTop: 14, fontSize: 11, color: 'var(--text-sub)', textAlign: 'center' }}>
          Open multiple tabs to test real-time collaboration
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [joinInfo, setJoinInfo] = useState<JoinInfo | null>(null);
  const [client, setClient] = useState<OTClient | null>(null);
  const [nodes, setNodes] = useState(new Map<string, CanvasNode>());
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [revision, setRevision] = useState(0);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [replaySeq, setReplaySeq] = useState<number | null>(null);
  const [replayNodes, setReplayNodes] = useState<Map<string, CanvasNode> | null>(null);
  const [denial, setDenial] = useState<string | null>(null);
  const [sideTab, setSideTab] = useState<'tasks' | 'events' | 'users'>('tasks');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [activePageId, setActivePageId] = useState(readInitialPageId);
  const [pages, setPages] = useState<CanvasPage[]>(() => readStoredPages(readInitialPageId()));
  const denialTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    window.localStorage.setItem(PAGE_STORAGE_KEY, JSON.stringify(pages));
  }, [pages]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activePageId === DEFAULT_PAGE_ID) {
      url.searchParams.delete('page');
    } else {
      url.searchParams.set('page', activePageId);
    }
    window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
  }, [activePageId]);

  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0]!;
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const url = new URL(window.location.href);
    if (activePageId === DEFAULT_PAGE_ID) {
      url.searchParams.delete('page');
    } else {
      url.searchParams.set('page', activePageId);
    }
    return url.toString();
  }, [activePageId]);

  const addPage = useCallback(() => {
    const nextIndex = pages.length + 1;
    const page: CanvasPage = {
      id: `page-${Date.now().toString(36)}`,
      name: `Page ${nextIndex}`,
      createdAt: Date.now(),
    };
    setPages((current) => [...current, page]);
    setActivePageId(page.id);
  }, [pages.length]);

  const heatmap: HeatmapData = useMemo(() => {
    const map = new Map<string, number>();
    for (const ev of events) {
      if (ev.node_id && (ev.event_type === 'update_node' || ev.event_type === 'add_node')) {
        map.set(ev.node_id, (map.get(ev.node_id) ?? 0) + 1);
      }
    }
    return map;
  }, [events]);

  const handleJoin = useCallback((info: JoinInfo) => {
    setJoinInfo(info);

    const c = new OTClient({
      sessionId: DEFAULT_SESSION,
      userId: info.userId,
      userName: info.name,
      role: info.role,
      color: info.color,
    });

    c.onNodesChange((map) => {
      setNodes(new Map(map));
      setRevision(c.getRevision());
    });
    c.onStatus(setStatus);
    c.onDenial(({ reason }) => {
      setDenial(reason);
      if (denialTimer.current) clearTimeout(denialTimer.current);
      denialTimer.current = setTimeout(() => setDenial(null), 3000);
    });
    c.onTasksChanged(() => {
      api.tasks.list(DEFAULT_SESSION).then(setTasks).catch(() => {});
    });

    c.connect();
    setClient(c);
    api.tasks.list(DEFAULT_SESSION).then(setTasks).catch(() => {});
    api.events.list(DEFAULT_SESSION).then(setEvents).catch(() => {});
  }, []);

  useEffect(() => {
    if (!joinInfo) return;
    const id = setInterval(() => {
      api.events.list(DEFAULT_SESSION).then(setEvents).catch(() => {});
      api.tasks.list(DEFAULT_SESSION).then(setTasks).catch(() => {});
    }, 6000);
    return () => clearInterval(id);
  }, [joinInfo]);

  const handleSeek = useCallback(async (seq: number | null) => {
    if (seq === null) {
      setReplaySeq(null);
      setReplayNodes(null);
      return;
    }
    setReplaySeq(seq);
    try {
      const { events: evs } = await api.replay.get(DEFAULT_SESSION, seq);
      const map = new Map<string, CanvasNode>();
      for (const ev of evs) {
        const p = (ev.payload ?? {}) as any;
        if (ev.event_type === 'add_node' && ev.node_id) {
          map.set(ev.node_id, {
            id: ev.node_id,
            kind: p.kind ?? 'sticky',
            x: p.x ?? 0,
            y: p.y ?? 0,
            w: p.w ?? 200,
            h: p.h ?? 120,
            color: p.color ?? '#5b6af7',
            text: p.text ?? '',
            ...p,
          });
        } else if (ev.event_type === 'update_node' && ev.node_id) {
          const n = map.get(ev.node_id);
          if (n) map.set(ev.node_id, { ...n, ...p });
        } else if (ev.event_type === 'delete_node' && ev.node_id) {
          map.delete(ev.node_id);
        } else if (ev.event_type === 'lock_node' && ev.node_id) {
          const n = map.get(ev.node_id);
          if (n) map.set(ev.node_id, { ...n, lockedToRole: p.lockedToRole ?? null });
        }
      }
      setReplayNodes(map);
    } catch {
      // Replay is non-destructive; keep the live state if reconstruction fails.
    }
  }, []);

  const handleNodeFocus = useCallback((nodeId: string) => {
    setFocusNodeId(nodeId);
    setTimeout(() => setFocusNodeId(null), 500);
  }, []);

  if (!joinInfo || !client) return <JoinDialog onJoin={handleJoin} />;

  const connectedPeers = Array.from(client.getCursorStates().values());

  return (
    <div className="app">
      <header className="header">
        <span className="header-logo">LIGMA</span>
        <div className="header-divider" />
        <span className="header-session">Main Brainstorm</span>
        <div className="page-switcher" aria-label="Workspace pages">
          {pages.map((page) => (
            <button
              key={page.id}
              className={`page-tab${activePageId === page.id ? ' active' : ''}`}
              onClick={() => setActivePageId(page.id)}
              title={page.name}
            >
              {page.name}
            </button>
          ))}
          <button className="page-add-btn" onClick={addPage} title="Add page" aria-label="Add page">
            <Plus size={15} />
          </button>
        </div>
        <div className="header-spacer" />

        <button
          className="tool-btn header-action"
          title="Share workspace page"
          onClick={() => setShowShare(true)}
        >
          <Share2 size={18} />
        </button>

        <button
          className="tool-btn header-action"
          title="Export AI Session Brief"
          style={{ color: 'var(--accent)', fontWeight: 700 }}
          onClick={() => setShowSummary(true)}
        >
          <FileText size={18} />
        </button>

        <button
          className="tool-btn header-action"
          title={showHeatmap ? 'Hide heatmap' : 'Show presence heatmap'}
          style={showHeatmap ? { background: 'rgba(249,115,22,.1)', color: '#f97316', borderColor: '#f97316' } : {}}
          onClick={() => setShowHeatmap((v) => !v)}
        >
          <Flame size={18} />
        </button>

        <div className="header-pill">
          <div className={`status-dot ${status}`} />
          {status === 'connected' ? 'Live' : status === 'connecting' ? 'Connecting...' : 'Offline'}
        </div>
        <div className="header-rev">rev {revision}</div>
        <div className="header-pill user-pill" style={{ gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: joinInfo.color }} />
          <strong>{joinInfo.name}</strong>
          <span style={{ opacity: .5 }}>-</span>
          <span style={{ color: 'var(--text-sub)' }}>{joinInfo.role}</span>
        </div>
      </header>

      <div className="app-body">
        <Canvas
          client={client}
          nodes={nodes}
          role={joinInfo.role}
          activePageId={activePageId}
          replayNodes={replayNodes}
          focusNodeId={focusNodeId}
          heatmap={heatmap}
          showHeatmap={showHeatmap}
        />

        <button
          className={`sidebar-toggle${isSidebarCollapsed ? ' collapsed' : ''}`}
          onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          aria-label={isSidebarCollapsed ? 'Open sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>

        <aside className={`sidebar${isSidebarCollapsed ? ' collapsed' : ''}`} aria-hidden={isSidebarCollapsed}>
          <div className="sidebar-tabs">
            {(['tasks', 'events', 'users'] as const).map((t) => (
              <button
                key={t}
                className={`sidebar-tab${sideTab === t ? ' active' : ''}`}
                onClick={() => setSideTab(t)}
                title={t.charAt(0).toUpperCase() + t.slice(1)}
              >
                {t === 'tasks' && <Brain size={16} />}
                {t === 'events' && <ClipboardList size={16} />}
                {t === 'users' && <Users size={16} />}
              </button>
            ))}
          </div>
          <div className="sidebar-body">
            {sideTab === 'tasks' && <TaskBoard tasks={tasks} onNodeFocus={handleNodeFocus} />}
            {sideTab === 'events' && <EventLog events={events} />}
            {sideTab === 'users' && (
              <div className="user-list">
                <div className="sidebar-section-title">In this session</div>
                <div className="user-row">
                  <div className="user-avatar" style={{ background: joinInfo.color }}>
                    {joinInfo.name[0]?.toUpperCase()}
                  </div>
                  <span className="user-name">{joinInfo.name}
                    <span style={{ fontSize: 10, color: 'var(--text-sub)', marginLeft: 4 }}>(you)</span>
                  </span>
                  <span className={`role-chip ${joinInfo.role}`}>{joinInfo.role}</span>
                </div>
                {connectedPeers.map((p: any) => (
                  <div key={p.userId} className="user-row">
                    <div className="user-avatar" style={{ background: p.color }}>
                      {(p.userName?.[0] ?? '?').toUpperCase()}
                    </div>
                    <span className="user-name">{p.userName}</span>
                  </div>
                ))}

                <div style={{ marginTop: 20, padding: '12px', background: 'var(--surface2)', borderRadius: 10, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-sub)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={12} /> OT Engine
                  </div>
                  {[
                    ['Algorithm', 'OT + Field-level Merge'],
                    ['Revision', `#${revision}`],
                    ['Concurrency', 'Optimistic'],
                    ['Conflict', 'Field-level merge'],
                    ['Broadcast', 'Delta ops only'],
                    ['Events', `${events.length}`],
                  ].map(([k, v]) => (
                    <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5 }}>
                      <span style={{ color: 'var(--text-sub)' }}>{k}</span>
                      <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{v}</span>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => setShowHeatmap((v) => !v)}
                  style={{
                    marginTop: 12,
                    width: '100%',
                    padding: '8px',
                    background: showHeatmap ? 'rgba(249,115,22,.1)' : 'var(--surface2)',
                    border: `1px solid ${showHeatmap ? '#f97316' : 'var(--border)'}`,
                    borderRadius: 8,
                    color: showHeatmap ? '#f97316' : 'var(--text-dim)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 12,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  <Flame size={14} /> {showHeatmap ? 'Hide' : 'Show'} Heatmap
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      <ReplayBar events={events} replaySeq={replaySeq} onSeek={handleSeek} />
      {showSummary && <SummaryModal onClose={() => setShowSummary(false)} />}
      {showShare && <ShareModal url={shareUrl} pageName={activePage.name} onClose={() => setShowShare(false)} />}
      {denial && <div className="denial-toast"><Ban size={16} /> {denial}</div>}
    </div>
  );
}
