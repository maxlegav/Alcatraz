'use client';

import { useState, useEffect, useCallback, useMemo, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { formatTimeAgo, formatTime } from '@/lib/agent-status';
import type { AgentStat, FeedEntry } from './types';
import type { Vulnerability, Guardrail } from '@/lib/supabase/types';
import { loadDashboardData, upsertRealtimeAgentStats } from './dashboard-data';
import AnalyzeButton from '../agents/[id]/AnalyzeButton';

// ── Types ─────────────────────────────────────────────────────────────────────
type HitlRequest = {
  id: string; agent_id: string; tool_name: string; tool_input: string;
  status: 'pending' | 'approved' | 'denied'; created_at: string;
};
type Session = { id: string; n: number; startedAt: string; endedAt?: string };
type RunStatus = { online: boolean; running: boolean; agent_id?: string; started_at?: string };

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = {
  Activity: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Shield: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  ),
  Percent: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
  ),
  Check: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  X: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Clock: () => (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  ChevronDown: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
  Lock: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  ),
  Warning: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

// ── KPI card ──────────────────────────────────────────────────────────────────
type Accent = 'blue' | 'red' | 'amber' | 'green';
const ACCENT: Record<Accent, { bar: string; value: string; icon: string }> = {
  blue:  { bar: 'bg-blue-600',    value: 'text-blue-700',    icon: 'bg-blue-50 text-blue-600'       },
  red:   { bar: 'bg-red-500',     value: 'text-red-700',     icon: 'bg-red-50 text-red-500'         },
  amber: { bar: 'bg-amber-500',   value: 'text-amber-700',   icon: 'bg-amber-50 text-amber-500'     },
  green: { bar: 'bg-emerald-500', value: 'text-emerald-700', icon: 'bg-emerald-50 text-emerald-500' },
};

function KpiCard({ label, value, sub, accent, icon, delay }: {
  label: string; value: string; sub?: string; accent: Accent; icon: ReactNode; delay: number;
}) {
  const c = ACCENT[accent];
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
    >
      <div className={cn('h-1 w-10 rounded-full mb-5', c.bar)} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1.5">{label}</p>
          <p className={cn('text-[40px] font-bold leading-none tracking-tight', c.value)}>{value}</p>
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', c.icon)}>{icon}</div>
      </div>
      {sub && <p className="text-sm text-slate-400 mt-4">{sub}</p>}
    </motion.div>
  );
}

// ── Session tabs ──────────────────────────────────────────────────────────────
function SessionTabs({ sessions, activeId, onSelect }: {
  sessions: Session[]; activeId: string; onSelect: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-100 overflow-x-auto shrink-0">
      <button
        onClick={() => onSelect('all')}
        className={cn(
          'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0',
          activeId === 'all' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
        )}
      >
        All runs
      </button>
      {sessions.map(s => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0',
            activeId === s.id ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700',
          )}
        >
          Run #{s.n}
          {!s.endedAt && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Log row ───────────────────────────────────────────────────────────────────
const SECURITY_EVENTS = new Set(['prompt_injection', 'sensitive_data_leak']);

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-slate-100 text-slate-500',
};

function extractHint(payload: Record<string, unknown> | null): string {
  if (!payload) return '';
  const direct = payload.command ?? payload.url ?? payload.path ?? payload.query ?? payload.table ?? payload.key ?? payload.to;
  if (direct) return String(direct);
  const input = payload.input as Record<string, unknown> | undefined;
  if (input) {
    const nested = input.command ?? input.url ?? input.path ?? input.query ?? input.target ?? input.to ?? input.key;
    if (nested) return String(nested);
  }
  return '';
}

function LogRow({ entry, agentName }: { entry: FeedEntry; agentName: string }) {
  const blocked = entry.status === 'BLOCKED';
  const isSecEv = SECURITY_EVENTS.has(entry.tool_name);
  const hint    = extractHint(entry.payload);

  return (
    <div className={cn(
      'grid items-center gap-0 px-5 py-3 border-b border-slate-100/80 text-xs transition-colors',
      'grid-cols-[16px_1fr_90px_72px_56px]',
      isSecEv   ? 'bg-red-50/80 hover:bg-red-50 border-l-[3px] border-l-red-500' :
      blocked   ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50',
    )}>
      {/* Status dot */}
      <span className={cn(
        'h-2 w-2 rounded-full shrink-0',
        isSecEv ? 'bg-red-600 animate-pulse' : blocked ? 'bg-red-400' : 'bg-emerald-400',
      )} />

      {/* Tool name + hint */}
      <div className="min-w-0 px-3">
        <div className="flex items-center gap-2">
          <span className={cn(
            'font-mono font-semibold truncate',
            isSecEv ? 'text-red-700 text-xs' : blocked ? 'text-slate-800' : 'text-slate-700',
          )}>
            {entry.tool_name}
          </span>
          {isSecEv && (
            <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-600 text-white">
              Injection
            </span>
          )}
        </div>
        {hint && (
          <span className="text-[10px] text-slate-400 truncate block mt-0.5 font-mono">{hint}</span>
        )}
      </div>

      {/* Agent name */}
      <span className="text-[10px] text-slate-400 truncate">{agentName}</span>

      {/* Severity */}
      <span className={cn(
        'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-center',
        entry.severity ? SEVERITY_STYLE[entry.severity] ?? 'bg-slate-100 text-slate-500' : '',
      )}>
        {entry.severity ?? ''}
      </span>

      {/* Time */}
      <span className="text-[10px] text-slate-400 tabular-nums text-right font-mono">
        {formatTime(entry.created_at)}
      </span>
    </div>
  );
}

// ── HITL Panel ────────────────────────────────────────────────────────────────
function HitlPanel({ requests, agentNameMap, onDecide }: {
  requests: HitlRequest[];
  agentNameMap: Record<string, string>;
  onDecide: (id: string, status: 'approved' | 'denied') => Promise<void>;
}) {
  const [deciding, setDeciding] = useState<Record<string, boolean>>({});

  const decide = async (id: string, status: 'approved' | 'denied') => {
    setDeciding(p => ({ ...p, [id]: true }));
    await onDecide(id, status);
    setDeciding(p => ({ ...p, [id]: false }));
  };

  if (requests.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.96 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-6 right-6 z-50 w-[420px] bg-white rounded-2xl border-2 border-amber-400 shadow-2xl overflow-hidden"
    >
      <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
        </span>
        <div>
          <p className="text-sm font-bold text-amber-900">Human Approval Required</p>
          <p className="text-xs text-amber-700">{requests.length} action{requests.length > 1 ? 's' : ''} waiting</p>
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto divide-y divide-slate-100">
        {requests.map(req => (
          <div key={req.id} className="px-5 py-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 truncate max-w-[120px]">
                    {agentNameMap[req.agent_id] ?? 'Agent'}
                  </span>
                  <span className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Icon.Clock /> {formatTimeAgo(req.created_at, Date.now())}
                  </span>
                </div>
                <p className="font-mono text-sm font-bold text-slate-800">{req.tool_name}</p>
              </div>
            </div>
            {req.tool_input && (
              <div className="mb-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Input</p>
                <p className="font-mono text-xs text-slate-600 break-all line-clamp-3">{req.tool_input}</p>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={() => decide(req.id, 'approved')} disabled={deciding[req.id]}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 transition-colors">
                <Icon.Check /> Approve
              </button>
              <button onClick={() => decide(req.id, 'denied')} disabled={deciding[req.id]}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 text-sm font-semibold py-2.5 transition-colors">
                <Icon.X /> Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Run Button ────────────────────────────────────────────────────────────────
function RunButton({ isRunning, onRun }: { isRunning: boolean; onRun: () => Promise<string | null> }) {
  const [error, setError] = useState('');

  const handleClick = async () => {
    if (isRunning) return;
    setError('');
    const err = await onRun();
    if (err) { setError(err); setTimeout(() => setError(''), 6000); }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isRunning}
        className={cn(
          'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
          isRunning ? 'bg-amber-100 text-amber-700 cursor-not-allowed' :
          error     ? 'bg-red-100 text-red-700' :
          'bg-blue-600 hover:bg-blue-700 text-white shadow-sm',
        )}
      >
        {isRunning ? (
          <>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-600" />
            </span>
            Running…
          </>
        ) : (
          <><Icon.Play /> Run Agent</>
        )}
      </button>
      {error && <p className="text-[10px] text-red-500 max-w-[220px] text-right leading-4">{error}</p>}
    </div>
  );
}

// ── Project Panel ─────────────────────────────────────────────────────────────
function ProjectPanel({
  running, agentName, agentId, startedAt, sessionEventCount, sessionBlockedCount,
}: {
  running: boolean; agentName: string | null; agentId: string | null;
  startedAt: string | null; sessionEventCount: number; sessionBlockedCount: number;
}) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startedAt) { setElapsed(''); return; }
    const update = () => {
      const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      setElapsed(secs < 60 ? `${secs}s` : `${Math.floor(secs / 60)}m ${secs % 60}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'rounded-2xl border shadow-sm p-4 transition-colors duration-500',
        running ? 'bg-blue-950 border-blue-700' : 'bg-white border-slate-200',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={cn('text-[10px] font-bold uppercase tracking-wider', running ? 'text-blue-300' : 'text-slate-400')}>
          Active Session
        </span>
        <div className="flex items-center gap-1.5">
          {running ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-400" />
              </span>
              <span className="text-[10px] font-semibold text-blue-300">RUNNING</span>
            </>
          ) : (
            <><span className="h-2 w-2 rounded-full bg-slate-300" /><span className="text-[10px] font-semibold text-slate-400">IDLE</span></>
          )}
        </div>
      </div>

      {agentName ? (
        <p className={cn('text-sm font-semibold truncate mb-3', running ? 'text-white' : 'text-slate-800')}>
          {agentName}
        </p>
      ) : (
        <p className={cn('text-sm truncate mb-3 italic', running ? 'text-blue-300' : 'text-slate-400')}>
          No agent selected
        </p>
      )}

      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { label: 'Elapsed', value: running && elapsed ? elapsed : '—' },
          { label: 'Events',  value: sessionEventCount > 0 ? String(sessionEventCount) : '—' },
          { label: 'Blocked', value: sessionEventCount > 0 ? String(sessionBlockedCount) : '—' },
        ].map(({ label, value }) => (
          <div key={label} className={cn('rounded-xl p-2 text-center', running ? 'bg-blue-900/60' : 'bg-slate-50')}>
            <p className={cn('text-[9px] font-medium mb-0.5', running ? 'text-blue-400' : 'text-slate-400')}>{label}</p>
            <p className={cn('text-xs font-bold tabular-nums', running ? 'text-white' : 'text-slate-500')}>{value}</p>
          </div>
        ))}
      </div>

      {agentId && (
        <Link
          href={`/agents/${agentId}`}
          className={cn('text-[11px] font-medium hover:underline', running ? 'text-blue-400' : 'text-blue-600')}
        >
          View agent details →
        </Link>
      )}
    </motion.div>
  );
}

// ── Audit Panel ───────────────────────────────────────────────────────────────
const SEV_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-slate-100 text-slate-500',
};

function AuditPanel({ agentId, agentName }: { agentId: string | null; agentName: string | null }) {
  const [vulns, setVulns]       = useState<Vulnerability[]>([]);
  const [guardrail, setGuardrail] = useState<Guardrail | null>(null);
  const [loading, setLoading]   = useState(false);
  const [scanDate, setScanDate] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    Promise.all([
      fetch(`/api/findings?agent_id=${agentId}`).then(r => r.json()),
      fetch(`/api/guardrails?agent_id=${agentId}`).then(r => r.json()),
    ]).then(([f, g]) => {
      const findings = (f.findings ?? []) as Array<{ vulnerabilities: Vulnerability[]; created_at: string }>;
      const latest = findings[0];
      setVulns(latest?.vulnerabilities ?? []);
      setScanDate(latest?.created_at ?? null);
      const guardrails = (g.guardrails ?? []) as Guardrail[];
      setGuardrail(guardrails[0] ?? null);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [agentId]);

  const runAnalysis = async () => {
    if (!agentId) return;
    setAnalyzing(true);
    await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agent_id: agentId }) })
      .catch(() => {});
    setAnalyzing(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col"
    >
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
            <Icon.Shield />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-800">Security Audit</p>
            {scanDate && <p className="text-[10px] text-slate-400">{formatTimeAgo(scanDate, Date.now())}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {agentId && <AnalyzeButton agentId={agentId} />}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
        {loading ? (
          <div className="text-center py-6 text-xs text-slate-400">Loading audit data…</div>
        ) : !agentId ? (
          <div className="text-center py-6 text-xs text-slate-400">Select an agent to view audit</div>
        ) : (
          <>
            {/* Vulnerabilities */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Icon.Warning />
                {vulns.length > 0 ? `${vulns.length} Vulnerabilities` : 'No scan results'}
              </p>
              {vulns.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-3 text-center">
                  <p className="text-xs text-slate-400">Run a red team scan to detect vulnerabilities</p>
                  <Link href="/" className="text-[11px] text-blue-600 hover:underline">
                    Go to onboarding →
                  </Link>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {vulns.map((v, i) => (
                    <div key={i} className="flex items-start gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                      <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full shrink-0 mt-0.5', SEV_BADGE[v.severity])}>
                        {v.severity}
                      </span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 truncate">{v.type}</p>
                        <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">{v.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Guardrails */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                <Icon.Lock />
                Guardrails
              </p>
              {!guardrail ? (
                <p className="text-xs text-slate-400 italic">No guardrails configured</p>
              ) : (
                <div className="space-y-2">
                  {guardrail.deny_patterns.length > 0 && (
                    <div>
                      <p className="text-[9px] font-bold text-red-500 uppercase tracking-wider mb-1">DENY</p>
                      <div className="flex flex-wrap gap-1">
                        {guardrail.deny_patterns.map(p => (
                          <span key={p} className="rounded-md bg-red-50 border border-red-100 px-1.5 py-0.5 font-mono text-[10px] text-red-600">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {guardrail.allow_patterns.length > 0 && (
                    <div>
                      <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider mb-1">ALLOW</p>
                      <div className="flex flex-wrap gap-1">
                        {guardrail.allow_patterns.map(p => (
                          <span key={p} className="rounded-md bg-emerald-50 border border-emerald-100 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700">{p}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {guardrail.max_calls_per_min != null && (
                    <p className="text-[10px] text-slate-400">
                      Rate limit: <span className="font-semibold text-slate-600">{guardrail.max_calls_per_min} calls/min</span>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Manual analysis */}
            <button
              onClick={runAnalysis}
              disabled={analyzing}
              className="w-full text-xs font-semibold text-slate-500 hover:text-slate-700 py-2 rounded-xl border border-slate-200 hover:border-slate-300 hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              {analyzing ? 'Analyzing…' : 'Run Pattern Analysis'}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}

// ── Agent selector dropdown ───────────────────────────────────────────────────
function AgentSelector({ agents, selectedId, onSelect }: {
  agents: AgentStat[]; selectedId: string | null; onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = agents.find(a => a.id === selectedId);

  if (agents.length === 0) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors text-sm"
      >
        <span className="h-2 w-2 rounded-full bg-blue-500" />
        <span className="text-slate-700 font-medium">{selected?.name ?? 'Select agent'}</span>
        <Icon.ChevronDown />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-20 w-56 rounded-xl border border-slate-200 bg-white shadow-lg py-1">
          {agents.map(a => (
            <button
              key={a.id}
              onClick={() => { onSelect(a.id); setOpen(false); }}
              className={cn(
                'w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2',
                a.id === selectedId ? 'text-blue-600 font-semibold' : 'text-slate-700',
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', a.id === selectedId ? 'bg-blue-500' : 'bg-slate-300')} />
              <span className="truncate">{a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Dashboard client ──────────────────────────────────────────────────────────
export default function DashboardClient() {
  const [now, setNow]                   = useState(() => Date.now());
  const [feed, setFeed]                 = useState<FeedEntry[]>([]);
  const [agentStats, setAgentStats]     = useState<AgentStat[]>([]);
  const [agentNameMap, setAgentNameMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading]       = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [hitlPending, setHitlPending]   = useState<HitlRequest[]>([]);
  const [runStatus, setRunStatus]       = useState<RunStatus>({ online: false, running: false });

  // Per-run session tracking
  const [sessions, setSessions]         = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('all');

  // Which agent to show in right panel
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Derived stats
  const totalCalls   = agentStats.reduce((s, a) => s + a.totalCalls,   0);
  const totalBlocked = agentStats.reduce((s, a) => s + a.blockedCalls, 0);
  const blockRate    = totalCalls > 0 ? (totalBlocked / totalCalls) * 100 : 0;
  const activeCount  = agentStats.filter(
    a => a.lastActive && now - new Date(a.lastActive).getTime() < 300_000
  ).length;

  // Session-scoped stats
  const currentSession = sessions.find(s => s.id === activeSessionId);
  const sessionStartMs = currentSession ? new Date(currentSession.startedAt).getTime()
    : (runStatus.started_at ? new Date(runStatus.started_at).getTime() : null);

  const sessionFeed = useMemo(() => {
    if (!sessionStartMs) return [];
    return feed.filter(e => new Date(e.created_at).getTime() >= sessionStartMs);
  }, [feed, sessionStartMs]);

  const sessionEventCount   = sessionFeed.length;
  const sessionBlockedCount = sessionFeed.filter(e => e.status === 'BLOCKED').length;

  // Filtered feed for display
  const displayFeed = useMemo(() => {
    if (activeSessionId === 'all') return feed;
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return feed;
    const start = new Date(session.startedAt).getTime();
    const end   = session.endedAt ? new Date(session.endedAt).getTime() : Infinity;
    return feed.filter(e => {
      const t = new Date(e.created_at).getTime();
      return t >= start && t <= end;
    });
  }, [feed, sessions, activeSessionId]);

  // Auto-select first agent when data loads
  useEffect(() => {
    if (selectedAgentId === null && agentStats.length > 0) {
      setSelectedAgentId(agentStats[0].id);
    }
  }, [agentStats, selectedAgentId]);

  // When run status agent changes, switch selected agent
  useEffect(() => {
    if (runStatus.agent_id) setSelectedAgentId(runStatus.agent_id);
  }, [runStatus.agent_id]);

  // Refresh relative timestamps
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Bootstrap
  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const [data, hitlRes] = await Promise.all([
          loadDashboardData(),
          fetch('/api/hitl').then(r => r.json()) as Promise<{ hitl_requests?: HitlRequest[] }>,
        ]);
        if (cancelled) return;
        setAgentStats(data.agentStats);
        setAgentNameMap(data.agentNameMap);
        setFeed(data.feed);
        setHitlPending(hitlRes.hitl_requests ?? []);
        setError(null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    void bootstrap();
    return () => { cancelled = true; };
  }, []);

  // Realtime new requests
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, (payload) => {
        const entry = payload.new as FeedEntry;
        setFeed(prev => [entry, ...prev.slice(0, 99)]);
        setAgentStats(prev => upsertRealtimeAgentStats(prev, entry));
        setAgentNameMap(prev => prev[entry.agent_id] ? prev : { ...prev, [entry.agent_id]: entry.agent_id });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Combined poll: HITL + run status
  useEffect(() => {
    const prevRunning = { current: false };
    const poll = setInterval(async () => {
      try {
        const [hitlRes, runRes] = await Promise.all([
          fetch('/api/hitl').then(r => r.json()) as Promise<{ hitl_requests?: HitlRequest[] }>,
          fetch('/api/run').then(r => r.json()) as Promise<RunStatus>,
        ]);
        setHitlPending(hitlRes.hitl_requests ?? []);
        setRunStatus(runRes);

        // Detect run end: mark current in-flight session as ended
        if (prevRunning.current && !runRes.running) {
          setSessions(prev => prev.map((s, i) =>
            i === prev.length - 1 && !s.endedAt ? { ...s, endedAt: new Date().toISOString() } : s
          ));
        }
        prevRunning.current = runRes.running;
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(poll);
  }, []);

  const handleRun = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/run', { method: 'POST' });
      const data = await res.json() as { status?: string; error?: string; hint?: string };
      if (!res.ok) return data.hint ?? data.error ?? 'Failed to start';

      const startedAt = new Date().toISOString();
      const newSession: Session = { id: crypto.randomUUID(), n: sessions.length + 1, startedAt };
      setSessions(prev => [...prev, newSession]);
      setActiveSessionId(newSession.id);
      setRunStatus(prev => ({ ...prev, running: true, started_at: startedAt }));
      return null;
    } catch {
      return 'Agent server offline — run: python -m alcatraz.serve';
    }
  }, [sessions.length]);

  const handleHitlDecide = useCallback(async (id: string, status: 'approved' | 'denied') => {
    await fetch(`/api/hitl/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    setHitlPending(prev => prev.filter(r => r.id !== id));
  }, []);

  const selectedAgent = agentStats.find(a => a.id === selectedAgentId) ?? null;
  const sessionAgentName = runStatus.agent_id ? (agentNameMap[runStatus.agent_id] ?? null) : null;

  return (
    <div className="flex flex-col h-screen bg-slate-50">

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="shrink-0 bg-white border-b border-slate-200 px-8 h-16 flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">Alcatraz</span>
          </div>
          <div className="w-px h-5 bg-slate-200" />
          <AgentSelector agents={agentStats} selectedId={selectedAgentId} onSelect={setSelectedAgentId} />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-600">Live</span>
          </div>
          <div className="w-px h-5 bg-slate-200" />
          {(() => {
            const last = sessions.filter(s => s.endedAt).at(-1);
            return last ? (
              <Link
                href={`/report?from=${encodeURIComponent(last.startedAt)}&to=${encodeURIComponent(last.endedAt!)}`}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300 px-3 py-1.5 rounded-xl transition-colors"
              >
                <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
                </svg>
                View Report
              </Link>
            ) : null;
          })()}
          <RunButton isRunning={runStatus.running} onRun={handleRun} />
        </div>
      </motion.header>

      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full max-w-[1440px] mx-auto px-8 py-6 flex flex-col gap-5">

          {/* KPI row */}
          <div className="grid grid-cols-4 gap-5 shrink-0">
            <KpiCard label="Total Requests" value={totalCalls.toLocaleString()} sub="Across all agents" accent="blue" icon={<Icon.Activity />} delay={0.1} />
            <KpiCard label="Threats Blocked" value={totalBlocked.toLocaleString()} sub={`${blockRate.toFixed(1)}% of all traffic`} accent="red" icon={<Icon.Shield />} delay={0.17} />
            <KpiCard label="Block Rate" value={`${blockRate.toFixed(1)}%`} sub={blockRate > 3 ? 'Elevated — review recommended' : 'Within normal range'} accent={blockRate > 10 ? 'red' : blockRate > 3 ? 'amber' : 'green'} icon={<Icon.Percent />} delay={0.24} />
            <KpiCard label="Active Agents" value={`${activeCount} / ${agentStats.length}`} sub="Active in the last 5 min" accent="green" icon={<Icon.Users />} delay={0.31} />
          </div>

          {/* Main body */}
          <div className="grid grid-cols-[1fr_300px] gap-5 flex-1 min-h-0">

            {/* Live feed */}
            <motion.div
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.36, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Feed header */}
              <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Live Feed</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeSessionId === 'all'
                      ? `${feed.length} total events`
                      : `${displayFeed.length} events in this run`}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                  </span>
                  <span className="text-xs font-medium text-blue-600">Realtime</span>
                </div>
              </div>

              {/* Session tabs */}
              {sessions.length > 0 && (
                <SessionTabs sessions={sessions} activeId={activeSessionId} onSelect={setActiveSessionId} />
              )}

              {/* Column headers */}
              <div className="shrink-0 grid grid-cols-[16px_1fr_90px_72px_56px] gap-0 items-center px-5 py-2 bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                <span />
                <span className="px-3">Tool · Payload</span>
                <span>Agent</span>
                <span>Severity</span>
                <span className="text-right">Time</span>
              </div>

              {/* Rows */}
              <div className="flex-1 overflow-y-auto min-h-0">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-4"><Icon.Activity /></div>
                    <p className="text-sm font-medium text-slate-600">Loading feed</p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16 px-6">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4"><Icon.Shield /></div>
                    <p className="text-sm font-medium text-slate-700">Dashboard load failed</p>
                    <p className="text-xs text-slate-400 mt-1">{error}</p>
                  </div>
                ) : displayFeed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-4"><Icon.Activity /></div>
                    <p className="text-sm font-medium text-slate-600">
                      {activeSessionId === 'all' ? 'No events yet' : 'No events in this run'}
                    </p>
                    <p className="text-xs text-slate-400 mt-1">Click "Run Agent" to start</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {displayFeed.map(entry => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18, ease: 'easeOut' }}
                        layout="position"
                      >
                        <LogRow entry={entry} agentName={agentNameMap[entry.agent_id] ?? entry.agent_id.slice(0, 8)} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>

            {/* Right panel: session + audit */}
            <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
              <ProjectPanel
                running={runStatus.running}
                agentName={sessionAgentName ?? selectedAgent?.name ?? null}
                agentId={runStatus.agent_id ?? selectedAgentId}
                startedAt={runStatus.started_at ?? null}
                sessionEventCount={sessionEventCount}
                sessionBlockedCount={sessionBlockedCount}
              />
              <div className="flex-1 min-h-0">
                <AuditPanel agentId={selectedAgentId} agentName={selectedAgent?.name ?? null} />
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* HITL floating panel */}
      <AnimatePresence>
        {hitlPending.length > 0 && (
          <HitlPanel requests={hitlPending} agentNameMap={agentNameMap} onDecide={handleHitlDecide} />
        )}
      </AnimatePresence>
    </div>
  );
}
