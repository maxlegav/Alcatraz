'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { formatTimeAgo, formatTime } from '@/lib/agent-status';
import type { AgentStat, FeedEntry } from './types';
import { loadDashboardData, upsertRealtimeAgentStats } from './dashboard-data';
import AnalyzeButton from '../agents/[id]/AnalyzeButton';

// ── Types ─────────────────────────────────────────────────────────────────────
type HitlRequest = {
  id: string;
  agent_id: string;
  tool_name: string;
  tool_input: string;
  status: 'pending' | 'approved' | 'denied';
  created_at: string;
};

// ── Health ────────────────────────────────────────────────────────────────────
type HealthTone = 'green' | 'amber' | 'red' | 'slate';
type Health = { label: string; blockRate: number; tone: HealthTone };

function deriveHealth(a: AgentStat): Health {
  const blockRate = a.totalCalls > 0 ? (a.blockedCalls / a.totalCalls) * 100 : 0;
  if (a.totalCalls === 0) return { label: 'Idle',     blockRate, tone: 'slate' };
  if (blockRate > 10)     return { label: 'Critical', blockRate, tone: 'red'   };
  if (blockRate > 3)      return { label: 'Elevated', blockRate, tone: 'amber' };
  return                         { label: 'Healthy',  blockRate, tone: 'green' };
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-violet-500', 'bg-emerald-500',
  'bg-orange-500', 'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-teal-500',
];
function avatarColor(id: string) {
  const code = id.split('').reduce((sum, c) => sum + c.charCodeAt(0), 0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

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
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  ),
  Users: () => (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Play: () => (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
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
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6"
    >
      <div className={cn('h-1 w-10 rounded-full mb-5', c.bar)} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500 mb-1.5">{label}</p>
          <p className={cn('text-[40px] font-bold leading-none tracking-tight', c.value)}>{value}</p>
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', c.icon)}>
          {icon}
        </div>
      </div>
      {sub && <p className="text-sm text-slate-400 mt-4">{sub}</p>}
    </motion.div>
  );
}

// ── Security event classification ─────────────────────────────────────────────
const SECURITY_TOOLS: Record<string, { label: string }> = {
  prompt_injection:    { label: 'Injection' },
  sensitive_data_leak: { label: 'Data Leak' },
};

// ── Log row ───────────────────────────────────────────────────────────────────
function LogRow({ entry, agentName }: { entry: FeedEntry; agentName: string }) {
  const blocked = entry.status === 'BLOCKED';
  const hint    = extractHint(entry.payload);
  const secEv   = SECURITY_TOOLS[entry.tool_name];

  return (
    <div className={cn(
      'flex items-center gap-4 px-5 py-3.5 border-b border-slate-100 transition-colors text-sm',
      secEv   ? 'bg-red-50 hover:bg-red-100/60 border-l-2 border-l-red-500' :
      blocked ? 'bg-red-50/50 hover:bg-red-50' : 'hover:bg-slate-50',
    )}>
      <span className={cn(
        'h-2 w-2 rounded-full shrink-0',
        secEv   ? 'bg-red-600 animate-pulse' :
        blocked ? 'bg-red-500' : 'bg-emerald-400',
      )} />
      <span className="shrink-0 text-xs font-medium text-slate-600 bg-slate-100 rounded-md px-2 py-1 w-36 truncate">
        {agentName}
      </span>
      <span className={cn(
        'font-mono text-sm shrink-0 w-32 truncate',
        secEv   ? 'text-red-800 font-bold' :
        blocked ? 'text-red-700 font-semibold' : 'text-slate-700',
      )}>
        {entry.tool_name}
      </span>
      {secEv ? (
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-600 text-white">
          {secEv.label}
        </span>
      ) : (
        <span className={cn(
          'shrink-0 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full',
          blocked ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600',
        )}>
          {blocked ? 'Blocked' : 'Allowed'}
        </span>
      )}
      {entry.severity && (
        <span className={cn(
          'shrink-0 text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full',
          entry.severity === 'critical' && 'bg-red-100 text-red-700',
          entry.severity === 'high'     && 'bg-orange-100 text-orange-700',
          entry.severity === 'medium'   && 'bg-amber-100 text-amber-700',
          entry.severity === 'low'      && 'bg-slate-100 text-slate-500',
        )}>
          {entry.severity}
        </span>
      )}
      <span className="text-xs text-slate-400 font-mono truncate flex-1 min-w-0">
        {hint || (secEv && entry.payload ? String((entry.payload as Record<string,unknown>).source ?? '') : '')}
      </span>
      <span className="text-xs text-slate-400 shrink-0 ml-auto font-mono tabular-nums">
        {formatTime(entry.created_at)}
      </span>
    </div>
  );
}

// ── HITL Panel ────────────────────────────────────────────────────────────────
function HitlPanel({
  requests,
  agentNameMap,
  onDecide,
}: {
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
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.96 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-6 right-6 z-50 w-[420px] bg-white rounded-2xl border-2 border-amber-400 shadow-2xl overflow-hidden"
    >
      {/* Header */}
      <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
        </span>
        <div>
          <p className="text-sm font-bold text-amber-900">Human Approval Required</p>
          <p className="text-xs text-amber-700">{requests.length} action{requests.length > 1 ? 's' : ''} waiting for operator review</p>
        </div>
      </div>

      {/* Requests */}
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
              <button
                onClick={() => decide(req.id, 'approved')}
                disabled={deciding[req.id]}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 transition-colors"
              >
                <Icon.Check /> Approve
              </button>
              <button
                onClick={() => decide(req.id, 'denied')}
                disabled={deciding[req.id]}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 text-sm font-semibold py-2.5 transition-colors"
              >
                <Icon.X /> Deny
              </button>
            </div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Agent card ────────────────────────────────────────────────────────────────
const HEALTH_BADGE: Record<HealthTone, string> = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red:   'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-500',
};
const HEALTH_BAR: Record<HealthTone, string> = {
  green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', slate: 'bg-slate-300',
};
const HEALTH_TEXT: Record<HealthTone, string> = {
  green: 'text-emerald-600', amber: 'text-amber-600', red: 'text-red-600', slate: 'text-slate-400',
};
const SUGGESTION_LABEL: Record<string, string> = {
  prompt_injection: 'Prompt fix', tool_redesign: 'Tool redesign',
  data_provision: 'Data source', other: 'Manual review',
};

function AgentCard({ agent, now, delay }: { agent: AgentStat; now: number; delay: number }) {
  const h   = deriveHealth(agent);
  const barW = `${Math.min(h.blockRate * 6, 100)}%`;
  const topPattern    = agent.latestInsight?.top_pattern ?? null;
  const recurringCount = agent.latestInsight?.recurring_tool_names.length ?? 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4"
    >
      <div className="flex items-start gap-3 mb-3.5">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0', avatarColor(agent.id))}>
            {agent.name[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <Link href={`/agents/${agent.id}`} className="block truncate text-sm font-semibold text-slate-800 hover:text-blue-700">
              {agent.name}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
              <span className={cn('inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full', HEALTH_BADGE[h.tone])}>
                {h.label}
              </span>
              {typeof agent.version === 'number' && (
                <span className="inline-block rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                  v{agent.version}
                </span>
              )}
              {recurringCount > 0 && (
                <span className="inline-block rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                  {recurringCount} recurring
                </span>
              )}
            </div>
          </div>
        </div>
        <AnalyzeButton agentId={agent.id} />
      </div>

      <div className="mb-3">
        <div className="flex justify-between items-center mb-1.5">
          <span className="text-xs text-slate-500">Block rate</span>
          <span className={cn('text-xs font-bold', HEALTH_TEXT[h.tone])}>{h.blockRate.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', HEALTH_BAR[h.tone])}
            initial={{ width: 0 }}
            animate={{ width: barW }}
            transition={{ delay: delay + 0.2, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {agent.latestInsight ? (
        <div className="mb-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Latest Insight</p>
            <span className="text-[10px] text-slate-400">{new Date(agent.latestInsight.created_at).toLocaleDateString()}</span>
          </div>
          {topPattern ? (
            <>
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded-full bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">{topPattern.tool_name}</span>
                <span className="text-[10px] font-medium text-slate-500">{topPattern.blocked_count} blocked</span>
                <span className="text-[10px] text-slate-400">{SUGGESTION_LABEL[topPattern.suggestion_type] ?? 'Review'}</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-500 line-clamp-3">{topPattern.suggestion}</p>
            </>
          ) : (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {agent.latestInsight.summary ?? 'No blocked patterns found in the latest analysis.'}
            </p>
          )}
          <Link href={`/agents/${agent.id}`} className="mt-2 inline-flex text-xs font-medium text-blue-600 hover:text-blue-700">
            View analysis
          </Link>
        </div>
      ) : (
        <div className="mb-3 rounded-2xl border border-dashed border-slate-200 p-3 text-xs text-slate-400">
          No analysis yet. Run the first scan from this card.
        </div>
      )}

      <div className="flex justify-between text-xs text-slate-400">
        <span>{agent.totalCalls.toLocaleString()} calls · {agent.blockedCalls} blocked</span>
        <span>{formatTimeAgo(agent.lastActive, now)}</span>
      </div>
    </motion.div>
  );
}

// ── Run Agent button ──────────────────────────────────────────────────────────
function RunButton({ isRunning, onRun }: { isRunning: boolean; onRun: () => Promise<string | null> }) {
  const [error, setError] = useState('');

  const handleClick = async () => {
    if (isRunning) return;
    setError('');
    const err = await onRun();
    if (err) {
      setError(err);
      setTimeout(() => setError(''), 6000);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isRunning}
        className={cn(
          'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all',
          isRunning ? 'bg-amber-100 text-amber-700 cursor-not-allowed' :
          error      ? 'bg-red-100 text-red-700' :
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
          <>
            <Icon.Play />
            Run Demo Agent
          </>
        )}
      </button>
      {error && (
        <p className="text-[10px] text-red-500 max-w-[220px] text-right leading-4">{error}</p>
      )}
    </div>
  );
}

// ── Active Session panel ───────────────────────────────────────────────────────
function SessionPanel({
  running,
  agentName,
  startedAt,
  sessionEventCount,
  sessionBlockedCount,
}: {
  running: boolean;
  agentName: string | null;
  startedAt: string | null;
  sessionEventCount: number;
  sessionBlockedCount: number;
}) {
  const [elapsed, setElapsed] = useState('');

  useEffect(() => {
    if (!startedAt) { setElapsed(''); return; }
    const update = () => {
      const secs = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
      if (secs < 60) setElapsed(`${secs}s`);
      else setElapsed(`${Math.floor(secs / 60)}m ${secs % 60}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.4, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        'rounded-2xl border shadow-sm p-4 mb-3 transition-colors duration-500',
        running
          ? 'bg-blue-950 border-blue-700'
          : 'bg-white border-slate-200',
      )}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3">
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
            <>
              <span className="h-2 w-2 rounded-full bg-slate-300" />
              <span className="text-[10px] font-semibold text-slate-400">IDLE</span>
            </>
          )}
        </div>
      </div>

      {/* Agent name */}
      <p className={cn('text-sm font-semibold truncate mb-3', running ? 'text-white' : 'text-slate-800')}>
        {agentName ?? 'AI Customer Research Agent'}
      </p>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className={cn('rounded-xl p-2.5 text-center', running ? 'bg-blue-900/60' : 'bg-slate-50')}>
          <p className={cn('text-[10px] font-medium mb-1', running ? 'text-blue-400' : 'text-slate-400')}>Elapsed</p>
          <p className={cn('text-sm font-bold tabular-nums', running ? 'text-white' : 'text-slate-500')}>
            {running && elapsed ? elapsed : '—'}
          </p>
        </div>
        <div className={cn('rounded-xl p-2.5 text-center', running ? 'bg-blue-900/60' : 'bg-slate-50')}>
          <p className={cn('text-[10px] font-medium mb-1', running ? 'text-blue-400' : 'text-slate-400')}>Events</p>
          <p className={cn('text-sm font-bold tabular-nums', running ? 'text-white' : 'text-slate-500')}>
            {sessionEventCount > 0 ? sessionEventCount : '—'}
          </p>
        </div>
        <div className={cn('rounded-xl p-2.5 text-center', running ? 'bg-blue-900/60' : 'bg-slate-50')}>
          <p className={cn('text-[10px] font-medium mb-1', running ? 'text-blue-400' : 'text-slate-400')}>Blocked</p>
          <p className={cn('text-sm font-bold tabular-nums', running && sessionBlockedCount > 0 ? 'text-red-400' : running ? 'text-white' : 'text-slate-500')}>
            {sessionEventCount > 0 ? sessionBlockedCount : '—'}
          </p>
        </div>
      </div>

      {/* Demo info */}
      {!running && (
        <p className="text-[10px] text-slate-400 leading-4">
          LangChain research agent · Supabase Realtime · HITL approvals
        </p>
      )}
      {running && (
        <div className="rounded-xl bg-blue-900/40 border border-blue-800 px-3 py-2">
          <p className="text-[10px] font-semibold text-blue-400 uppercase tracking-wider mb-1">Demo scenario</p>
          <p className="text-[11px] text-blue-200 leading-4">
            AI research agent · web_search → database_query → send_report
          </p>
        </div>
      )}
    </motion.div>
  );
}

type RunStatus = {
  online: boolean;
  running: boolean;
  agent_id?: string;
  started_at?: string;
};

// ── Dashboard client ──────────────────────────────────────────────────────────
export default function DashboardClient() {
  const [now, setNow]                 = useState(() => Date.now());
  const [feed, setFeed]               = useState<FeedEntry[]>([]);
  const [agentStats, setAgentStats]   = useState<AgentStat[]>([]);
  const [agentNameMap, setAgentNameMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading]     = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [hitlPending, setHitlPending] = useState<HitlRequest[]>([]);
  const [runStatus, setRunStatus]     = useState<RunStatus>({ online: false, running: false });

  const totalCalls   = agentStats.reduce((s, a) => s + a.totalCalls,   0);
  const totalBlocked = agentStats.reduce((s, a) => s + a.blockedCalls, 0);
  const blockRate    = totalCalls > 0 ? (totalBlocked / totalCalls) * 100 : 0;
  const activeCount  = agentStats.filter(
    a => a.lastActive && now - new Date(a.lastActive).getTime() < 300_000
  ).length;

  // Session-scoped event counts (entries after the session started_at)
  const sessionStarted = runStatus.started_at ? new Date(runStatus.started_at).getTime() : null;
  const sessionFeed    = sessionStarted
    ? feed.filter(e => new Date(e.created_at).getTime() >= sessionStarted)
    : [];
  const sessionEventCount   = sessionFeed.length;
  const sessionBlockedCount = sessionFeed.filter(e => e.status === 'BLOCKED').length;
  const sessionAgentName    = runStatus.agent_id ? (agentNameMap[runStatus.agent_id] ?? null) : null;

  // Refresh relative timestamps every 30s
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  // Bootstrap dashboard
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

  // Realtime — new requests
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, (payload) => {
        const entry = payload.new as FeedEntry;
        setFeed(prev => [entry, ...prev.slice(0, 49)]);
        setAgentStats(prev => upsertRealtimeAgentStats(prev, entry));
        setAgentNameMap(prev => prev[entry.agent_id] ? prev : { ...prev, [entry.agent_id]: entry.agent_id });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Poll /api/hitl every 3s — Supabase Realtime with anon key doesn't reliably
  // deliver hitl_requests events due to RLS, so polling is more robust.
  // Poll /api/run every 3s for session status (running, agent_id, started_at).
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const [hitlRes, runRes] = await Promise.all([
          fetch('/api/hitl').then(r => r.json()) as Promise<{ hitl_requests?: HitlRequest[] }>,
          fetch('/api/run').then(r => r.json()) as Promise<RunStatus>,
        ]);
        setHitlPending(hitlRes.hitl_requests ?? []);
        setRunStatus(runRes);
      } catch {
        // ignore transient errors
      }
    }, 3000);
    return () => clearInterval(poll);
  }, []);

  // Trigger the demo agent — returns an error string or null on success.
  const handleRun = useCallback(async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/run', { method: 'POST' });
      const data = await res.json() as { status?: string; error?: string; hint?: string };
      if (!res.ok) return data.hint ?? data.error ?? 'Failed to start';
      // Immediately reflect running state (next poll will confirm)
      setRunStatus(prev => ({ ...prev, running: true, started_at: new Date().toISOString() }));
      return null;
    } catch {
      return 'Agent server offline — run: python -m alcatraz.serve';
    }
  }, []);

  const handleHitlDecide = useCallback(async (id: string, status: 'approved' | 'denied') => {
    await fetch(`/api/hitl/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    // Optimistically remove from list
    setHitlPending(prev => prev.filter(r => r.id !== id));
  }, []);

  return (
    <div className="flex flex-col h-screen bg-slate-50">

      {/* ── Header ── */}
      <motion.header
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="shrink-0 bg-white border-b border-slate-200 px-8 h-16 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-sm">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <span className="font-bold text-slate-900 text-lg tracking-tight">Alcatraz</span>
          <span className="text-slate-300">·</span>
          <span className="text-sm text-slate-500">Agent Security</span>
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
          <RunButton isRunning={runStatus.running} onRun={handleRun} />
        </div>
      </motion.header>

      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full max-w-[1440px] mx-auto px-8 py-6 flex flex-col gap-6">

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="shrink-0"
          >
            <h1 className="text-2xl font-bold text-slate-900">Security Dashboard</h1>
            <p className="text-sm text-slate-500 mt-1">Real-time monitoring of your AI agent ecosystem</p>
          </motion.div>

          {/* ── KPI row ── */}
          <div className="grid grid-cols-4 gap-5 shrink-0">
            <KpiCard label="Total Requests" value={totalCalls.toLocaleString()} sub="Across all agents" accent="blue" icon={<Icon.Activity />} delay={0.15} />
            <KpiCard label="Threats Blocked" value={totalBlocked.toLocaleString()} sub={`${blockRate.toFixed(1)}% of all traffic`} accent="red" icon={<Icon.Shield />} delay={0.22} />
            <KpiCard label="Block Rate" value={`${blockRate.toFixed(1)}%`} sub={blockRate > 3 ? 'Elevated — review recommended' : 'Within normal range'} accent={blockRate > 10 ? 'red' : blockRate > 3 ? 'amber' : 'green'} icon={<Icon.Percent />} delay={0.29} />
            <KpiCard label="Active Agents" value={`${activeCount} / ${agentStats.length}`} sub="Active in the last 5 min" accent="green" icon={<Icon.Users />} delay={0.36} />
          </div>

          {/* ── Main body ── */}
          <div className="grid grid-cols-[1fr_300px] gap-5 flex-1 min-h-0">

            {/* Live feed */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Live Feed</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Intercepted tool calls, newest first</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="text-xs text-slate-400">{feed.length} events</span>
                  <span className="w-px h-4 bg-slate-200" />
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-blue-500" />
                  </span>
                  <span className="text-xs font-medium text-blue-600">Live</span>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-100 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                <span className="w-2 shrink-0" />
                <span className="w-36 shrink-0">Agent</span>
                <span className="w-32 shrink-0">Tool</span>
                <span className="w-20 shrink-0">Status</span>
                <span className="flex-1">Payload</span>
                <span className="shrink-0">Time</span>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-4"><Icon.Activity /></div>
                    <p className="text-sm font-medium text-slate-600">Loading requests</p>
                    <p className="text-xs text-slate-400 mt-1">Pulling the latest intercepted tool calls</p>
                  </div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16 px-6">
                    <div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4"><Icon.Shield /></div>
                    <p className="text-sm font-medium text-slate-700">Dashboard load failed</p>
                    <p className="text-xs text-slate-400 mt-1">{error}</p>
                  </div>
                ) : feed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-4"><Icon.Activity /></div>
                    <p className="text-sm font-medium text-slate-600">No requests yet</p>
                    <p className="text-xs text-slate-400 mt-1">Click "Run Demo Agent" to start</p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {feed.map(entry => (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        layout="position"
                      >
                        <LogRow entry={entry} agentName={agentNameMap[entry.agent_id] ?? entry.agent_id} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>

            {/* Agents panel */}
            <div className="flex flex-col min-h-0 overflow-hidden">
              {/* Active Session panel — always visible, dark when running */}
              <SessionPanel
                running={runStatus.running}
                agentName={sessionAgentName}
                startedAt={runStatus.started_at ?? null}
                sessionEventCount={sessionEventCount}
                sessionBlockedCount={sessionBlockedCount}
              />

              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.42, duration: 0.3 }}
                className="shrink-0 mb-4"
              >
                <h2 className="text-sm font-semibold text-slate-800">
                  Agents <span className="text-slate-400 font-normal">{agentStats.length} registered</span>
                </h2>
              </motion.div>
              <div className="flex-1 overflow-y-auto flex flex-col gap-3 pr-0.5">
                {isLoading ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
                    <p className="text-sm text-slate-500">Loading agents</p>
                  </div>
                ) : agentStats.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center">
                    <p className="text-sm text-slate-500">No agents registered yet</p>
                  </div>
                ) : (
                  agentStats.map((agent, i) => (
                    <AgentCard key={agent.id} agent={agent} now={now} delay={0.48 + i * 0.07} />
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── HITL floating panel ── */}
      <AnimatePresence>
        {hitlPending.length > 0 && (
          <HitlPanel
            requests={hitlPending}
            agentNameMap={agentNameMap}
            onDecide={handleHitlDecide}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
