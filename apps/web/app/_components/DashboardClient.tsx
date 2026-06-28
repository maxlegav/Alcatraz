'use client';

import { useState, useEffect, useCallback, useMemo, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase/client';
import { formatTimeAgo, formatTime } from '@/lib/agent-status';
import type { AgentStat, FeedEntry } from './types';
import type { InsightSummary } from '@/lib/insight-summary';
import type { Guardrail } from '@/lib/supabase/types';
import { loadDashboardData, upsertRealtimeAgentStats } from './dashboard-data';
import AnalyzeButton from '../agents/[id]/AnalyzeButton';
import AttackPathModal from './AttackPathModal';
import CompareFeeds from './CompareFeeds';

// ── Types ─────────────────────────────────────────────────────────────────────
type HitlRequest = {
  id: string; agent_id: string; tool_name: string; tool_input: string;
  status: 'pending' | 'approved' | 'denied'; created_at: string;
};
type Session = { id: string; n: number; startedAt: string; endedAt?: string };
type RunStatus = { online: boolean; running: boolean; run_count?: number; agent_id?: string; started_at?: string };
type RiskLevel = 'critical' | 'high' | 'medium' | 'low';
type RiskInfo = { level: RiskLevel; reason: string; cvss: number };

// Unified display entry — requests + HITL both rendered in the feed
type DisplayStatus = 'ALLOWED' | 'BLOCKED' | 'REVIEW';
type HitlDecision = 'pending' | 'approved' | 'denied';
type DisplayEntry = {
  id: string; agent_id: string; tool_name: string;
  displayStatus: DisplayStatus;
  severity: string | null; payload: Record<string, unknown> | null;
  created_at: string;
  isHitl?: boolean;
  hitlDecision?: HitlDecision;
};

function hitlDecisionFromPayload(payload: Record<string, unknown> | null): HitlDecision | undefined {
  const value = payload?.hitl;
  return value === 'approved' || value === 'denied' || value === 'pending' ? value : undefined;
}

function displayStatusForRequest(status: string, payload: Record<string, unknown> | null): DisplayStatus {
  const hitlDecision = hitlDecisionFromPayload(payload);
  if (hitlDecision === 'approved') return 'ALLOWED';
  if (hitlDecision === 'pending') return 'REVIEW';
  return status as DisplayStatus;
}

function isBlockedRequest(status: string, payload: Record<string, unknown> | null): boolean {
  return displayStatusForRequest(status, payload) === 'BLOCKED';
}

// ── Risk assessment ────────────────────────────────────────────────────────────
function assessRisk(toolName: string, toolInput: string): RiskInfo {
  const name  = toolName.toLowerCase();
  const input = toolInput.toLowerCase();
  if (['bash', 'exec', 'shell', 'system', 'subprocess', 'popen'].some(k => name.includes(k))) {
    return { level: 'critical', reason: 'Code execution — arbitrary command injection possible', cvss: 9.8 };
  }
  if (['delete', 'drop', 'truncate', 'rm ', 'remove'].some(k => name.includes(k) || input.includes(k))) {
    return { level: 'high', reason: 'Destructive operation — irreversible data loss risk', cvss: 8.1 };
  }
  if (['database', 'query', 'sql', 'db_'].some(k => name.includes(k))) {
    return { level: 'high', reason: 'Database access — sensitive data exposure risk', cvss: 7.5 };
  }
  if (['send', 'email', 'report', 'upload', 'post', 'webhook', 'notify'].some(k => name.includes(k))) {
    return { level: 'medium', reason: 'External data transfer — potential data exfiltration', cvss: 5.3 };
  }
  return { level: 'low', reason: 'Standard read-only operation', cvss: 2.1 };
}

const RISK_STYLE: Record<RiskLevel, { badge: string; bg: string; border: string; text: string }> = {
  critical: { badge: 'bg-red-600 text-white',          bg: 'bg-red-50',     border: 'border-red-200',    text: 'text-red-600'    },
  high:     { badge: 'bg-orange-500 text-white',        bg: 'bg-orange-50',  border: 'border-orange-200', text: 'text-orange-600' },
  medium:   { badge: 'bg-amber-500 text-white',         bg: 'bg-amber-50',   border: 'border-amber-200',  text: 'text-amber-600'  },
  low:      { badge: 'bg-slate-500 text-white',         bg: 'bg-slate-50',   border: 'border-slate-200',  text: 'text-slate-500'  },
};

function cvssRange(severity: string | null): string {
  if (severity === 'critical') return '9.0–10.0';
  if (severity === 'high')     return '7.0–8.9';
  if (severity === 'medium')   return '4.0–6.9';
  return '0.1–3.9';
}

// ── Icons ─────────────────────────────────────────────────────────────────────
const Icon = {
  Activity: () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>,
  Shield:   () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  Percent:  () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></svg>,
  Users:    () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  Play:     () => <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>,
  Check:    () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  X:        () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  Clock:    () => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  ChevronDown: () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>,
  Lock:     () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>,
  Plus:     () => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
  Close:    () => <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>,
  Report:   () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
};

// ── KPI card ──────────────────────────────────────────────────────────────────
type Accent = 'blue' | 'red' | 'amber' | 'green';
const ACCENT: Record<Accent, { bar: string; value: string; icon: string }> = {
  blue:  { bar: 'bg-violet-600',  value: 'text-violet-700',  icon: 'bg-violet-50 text-violet-600'   },
  red:   { bar: 'bg-red-500',     value: 'text-red-700',     icon: 'bg-red-50 text-red-500'         },
  amber: { bar: 'bg-amber-500',   value: 'text-amber-700',   icon: 'bg-amber-50 text-amber-500'     },
  green: { bar: 'bg-emerald-500', value: 'text-emerald-700', icon: 'bg-emerald-50 text-emerald-500' },
};
function KpiCard({ label, value, sub, accent, icon, delay }: { label: string; value: string; sub?: string; accent: Accent; icon: ReactNode; delay: number }) {
  const c = ACCENT[accent];
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
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
function formatRunLabel(s: Session): string {
  const d = new Date(s.startedAt);
  const dd  = String(d.getDate()).padStart(2, '0');
  const mon = d.toLocaleString('en-US', { month: 'short' });
  const hh  = String(d.getHours()).padStart(2, '0');
  const mm  = String(d.getMinutes()).padStart(2, '0');
  return `Run ${dd}-${mon} ${hh}:${mm}`;
}

function SessionTabs({ sessions, activeId, onSelect }: { sessions: Session[]; activeId: string; onSelect: (id: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 px-5 py-3 border-b border-slate-100 overflow-x-auto shrink-0">
      <button onClick={() => onSelect('all')}
        className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0', activeId === 'all' ? 'bg-[#635bff] text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700')}>
        All runs
      </button>
      {sessions.map(s => (
        <button key={s.id} onClick={() => onSelect(s.id)}
          className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0', activeId === s.id ? 'bg-[#635bff] text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700')}>
          {formatRunLabel(s)}
          {!s.endedAt && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
            </span>
          )}
          {s.endedAt && (
            <Link
              href={`/report?from=${encodeURIComponent(s.startedAt)}&to=${encodeURIComponent(s.endedAt)}`}
              onClick={e => e.stopPropagation()}
              className={cn('ml-1 flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase transition-colors', activeId === s.id ? 'bg-violet-500 text-white hover:bg-violet-400' : 'bg-slate-200 text-slate-500 hover:bg-slate-300')}
            >
              <Icon.Report /> Report
            </Link>
          )}
        </button>
      ))}
    </div>
  );
}

// ── Log row + detail modal ────────────────────────────────────────────────────
const SECURITY_EVENTS = new Set(['prompt_injection', 'sensitive_data_leak']);
const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700', high: 'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700', low: 'bg-slate-100 text-slate-500',
};
function extractHint(payload: Record<string, unknown> | null): string {
  if (!payload) return '';
  const direct = payload.command ?? payload.url ?? payload.path ?? payload.query ?? payload.table ?? payload.key ?? payload.to;
  if (direct) return String(direct);
  const input = payload.input as Record<string, unknown> | undefined;
  if (input) { const nested = input.command ?? input.url ?? input.path ?? input.query ?? input.target ?? input.to ?? input.key; if (nested) return String(nested); }
  return '';
}

function LogRow({ entry, agentName, onClick }: { entry: DisplayEntry; agentName: string; onClick: () => void }) {
  const blocked = entry.displayStatus === 'BLOCKED';
  const review  = entry.displayStatus === 'REVIEW';
  const isSecEv = SECURITY_EVENTS.has(entry.tool_name);
  const hint    = extractHint(entry.payload);
  return (
    <div
      onClick={onClick}
      className={cn(
        'grid items-center gap-0 px-5 py-3 border-b border-slate-100/80 text-xs transition-colors cursor-pointer select-none',
        'grid-cols-[8px_1fr_80px_90px_56px]',
        isSecEv ? 'bg-red-50/80 hover:bg-red-50 border-l-[3px] border-l-red-500' :
        review  ? 'bg-amber-50/60 hover:bg-amber-50/90' :
        blocked ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50',
      )}
    >
      <span className={cn('h-2 w-2 rounded-full shrink-0', isSecEv ? 'bg-red-600 animate-pulse' : review ? 'bg-amber-400 animate-pulse' : blocked ? 'bg-red-400' : 'bg-emerald-400')} />
      <div className="min-w-0 px-3">
        <div className="flex items-center gap-2">
          <span className={cn('font-mono font-semibold truncate', isSecEv ? 'text-red-700' : review ? 'text-amber-700' : blocked ? 'text-slate-800' : 'text-slate-700')}>{entry.tool_name}</span>
          {isSecEv && <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-600 text-white">Injection</span>}
          {review   && <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500 text-white">⏳ HITL</span>}
          {entry.isHitl && entry.hitlDecision === 'approved' && <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-600 text-white">✓ HITL approved</span>}
          {entry.isHitl && entry.hitlDecision === 'denied'   && <span className="shrink-0 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-red-700 text-white">✗ HITL denied</span>}
        </div>
        {hint && <span className="text-[10px] text-slate-400 truncate block mt-0.5 font-mono">{hint}</span>}
      </div>
      <span className="text-[10px] text-slate-400 truncate">{agentName}</span>
      {/* Status badge */}
      <span className={cn('text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full text-center',
        review  ? 'bg-amber-100 text-amber-700' :
        blocked ? 'bg-red-100 text-red-700' :
                  'bg-emerald-100 text-emerald-700'
      )}>
        {entry.displayStatus}
      </span>
      <span className="text-[10px] text-slate-400 tabular-nums text-right font-mono">{formatTime(entry.created_at)}</span>
    </div>
  );
}

function LogEntryModal({ entry, agentName, onClose }: { entry: DisplayEntry; agentName: string; onClose: () => void }) {
  const blocked  = entry.displayStatus === 'BLOCKED';
  const review   = entry.displayStatus === 'REVIEW';
  const isSecEv  = SECURITY_EVENTS.has(entry.tool_name);
  const cvss     = cvssRange(entry.severity);
  const hint     = extractHint(entry.payload);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className={cn('px-5 py-4 border-b flex items-start justify-between gap-3', isSecEv ? 'bg-red-50 border-red-200' : review ? 'bg-amber-50 border-amber-200' : blocked ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-200')}>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={cn('text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', review ? 'bg-amber-100 text-amber-700' : blocked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700')}>{entry.displayStatus}</span>
              {entry.severity && <span className={cn('text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', SEVERITY_STYLE[entry.severity])}>{entry.severity}</span>}
              {isSecEv && <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-600 text-white">Injection</span>}
            </div>
            <p className="font-mono font-bold text-slate-800 text-base">{entry.tool_name}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{agentName} · {formatTime(entry.created_at)}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-1">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* CVSS */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">CVSS Range</p>
              <p className="text-sm font-bold text-slate-800">{cvss}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Severity</p>
              <p className="text-sm font-bold text-slate-800 capitalize">{entry.severity ?? 'N/A'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider mb-1">Decision</p>
              <p className={cn('text-sm font-bold', blocked ? 'text-red-600' : review ? 'text-amber-600' : 'text-emerald-600')}>{entry.displayStatus}</p>
            </div>
          </div>

          {hint && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Payload hint</p>
              <p className="font-mono text-sm text-slate-700 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 break-all">{hint}</p>
            </div>
          )}

          {entry.payload && Object.keys(entry.payload).length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Full payload</p>
              <pre className="text-[11px] font-mono text-slate-600 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
                {JSON.stringify(entry.payload, null, 2)}
              </pre>
            </div>
          )}

          {blocked && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-500 mb-1">Block reason</p>
              <p className="text-xs text-red-700">{isSecEv ? 'Prompt injection detected in tool input — auto-blocked by security engine.' : 'Tool matched a DENY rule configured for this agent.'}</p>
            </div>
          )}
          {review && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 mb-1">Pending human review</p>
              <p className="text-xs text-amber-800">This tool is in the REVIEW list — a human must approve or deny before execution proceeds.</p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ── Report ready toast ────────────────────────────────────────────────────────
function ReportReadyToast({ href, onClose }: { href: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 12000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-slate-900 text-white rounded-2xl border border-slate-700 shadow-2xl px-5 py-3.5 min-w-[340px]"
    >
      <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold">Run complete — report ready</p>
        <p className="text-xs text-slate-400 mt-0.5">Security report generated for this session</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Link href={href} className="text-xs font-semibold text-violet-400 hover:text-violet-300 transition-colors whitespace-nowrap">
          View Report →
        </Link>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>
      </div>
    </motion.div>
  );
}

// ── HITL Panel ────────────────────────────────────────────────────────────────
function HitlPanel({ requests, agentNameMap, onDecide }: {
  requests: HitlRequest[]; agentNameMap: Record<string, string>;
  onDecide: (id: string, status: 'approved' | 'denied') => Promise<void>;
}) {
  const [deciding, setDeciding] = useState<Record<string, boolean>>({});
  const decide = async (id: string, status: 'approved' | 'denied') => {
    setDeciding(p => ({ ...p, [id]: true }));
    await onDecide(id, status);
    setDeciding(p => ({ ...p, [id]: false }));
  };
  if (requests.length === 0) return null;

  const sorted = [...requests].sort((a, b) => {
    const ra = assessRisk(a.tool_name, a.tool_input);
    const rb = assessRisk(b.tool_name, b.tool_input);
    return rb.cvss - ra.cvss;
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.96 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-6 right-6 z-50 w-[440px] bg-white rounded-2xl border-2 border-amber-400 shadow-2xl overflow-hidden"
    >
      <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center gap-3">
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
        </span>
        <div>
          <p className="text-sm font-bold text-amber-900">Human Approval Required</p>
          <p className="text-xs text-amber-700">
            {requests.length} action{requests.length > 1 ? 's' : ''} pending · highest risk shown first
          </p>
        </div>
      </div>
      <div className="max-h-[480px] overflow-y-auto divide-y divide-slate-100">
        {sorted.map(req => {
          const risk = assessRisk(req.tool_name, req.tool_input);
          const rs   = RISK_STYLE[risk.level];
          return (
            <div key={req.id} className="px-5 py-4">
              {/* Risk badge + tool name */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className={cn('text-[10px] font-bold uppercase px-2 py-0.5 rounded-full', rs.badge)}>
                      {risk.level} risk
                    </span>
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 truncate max-w-[120px]">
                      {agentNameMap[req.agent_id] ?? 'Agent'}
                    </span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <Icon.Clock /> {formatTimeAgo(req.created_at, Date.now())}
                    </span>
                  </div>
                  <p className="font-mono text-sm font-bold text-slate-800">{req.tool_name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{risk.reason}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] text-slate-400">CVSS</p>
                  <p className={cn('text-sm font-bold tabular-nums', rs.text)}>{risk.cvss.toFixed(1)}</p>
                </div>
              </div>

              {req.tool_input && (
                <div className={cn('mb-3 rounded-xl border px-3 py-2.5', rs.bg, rs.border)}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tool Input</p>
                  <p className="font-mono text-xs text-slate-700 break-all line-clamp-4">{req.tool_input}</p>
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
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Run Button ────────────────────────────────────────────────────────────────
function RunButton({ isRunning, onRun, label = 'Run Agent', idleClass = 'bg-[linear-gradient(135deg,#6965f4_0%,#5b7dff_100%)] text-white shadow-[0_4px_14px_rgba(99,91,255,0.26)] hover:shadow-[0_8px_24px_rgba(99,91,255,0.34)]' }: {
  isRunning: boolean; onRun: () => Promise<string | null>;
  label?: string; idleClass?: string;
}) {
  const [error, setError] = useState('');
  const handleClick = async () => {
    if (isRunning) return;
    setError('');
    const err = await onRun();
    if (err) { setError(err); setTimeout(() => setError(''), 6000); }
  };
  return (
    <div className="flex flex-col items-end gap-1">
      <button onClick={handleClick} disabled={isRunning}
        className={cn('flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-all', isRunning ? 'bg-amber-100 text-amber-700 cursor-not-allowed' : error ? 'bg-red-100 text-red-700' : idleClass)}>
        {isRunning ? (
          <><span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-amber-600" /></span>Running…</>
        ) : (
          <><Icon.Play /> {label}</>
        )}
      </button>
      {error && <p className="text-[10px] text-red-500 max-w-[220px] text-right leading-4">{error}</p>}
    </div>
  );
}

// ── Guardrails Panel ──────────────────────────────────────────────────────────
type PanelTab = 'Guardrails' | 'HITL' | 'Insights';

function EditableChips({
  items, color, onAdd, onRemove,
}: {
  items: string[]; color: 'red' | 'amber' | 'emerald';
  onAdd: (v: string) => void; onRemove: (v: string) => void;
}) {
  const [draft, setDraft] = useState('');
  const chip: Record<string, string> = {
    red: 'bg-red-50 border border-red-200 text-red-700', amber: 'bg-amber-50 border border-amber-200 text-amber-700', emerald: 'bg-emerald-50 border border-emerald-200 text-emerald-700',
  };
  const input: Record<string, string> = {
    red: 'focus:ring-red-300', amber: 'focus:ring-amber-300', emerald: 'focus:ring-emerald-300',
  };
  const submit = () => {
    const v = draft.trim();
    if (v && !items.includes(v)) onAdd(v);
    setDraft('');
  };
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      {items.map(item => (
        <span key={item} className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold', chip[color])}>
          {item}
          <button onClick={() => onRemove(item)} className="opacity-50 hover:opacity-100 ml-0.5">
            <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </span>
      ))}
      <input
        value={draft} onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
        onBlur={submit}
        placeholder="+ add"
        className={cn('text-[11px] font-mono border border-dashed border-slate-300 rounded-md px-2 py-0.5 bg-transparent text-slate-500 placeholder-slate-400 focus:outline-none focus:ring-1 w-14', input[color])}
      />
    </div>
  );
}

function GuardrailsPanel({ agentId, insight, ffInsights }: { agentId: string | null; insight?: InsightSummary | null; ffInsights?: boolean }) {
  const [tab, setTab]           = useState<PanelTab>('Guardrails');
  const [guardrail, setGuardrail] = useState<Guardrail | null>(null);
  const [deny, setDeny]         = useState<string[]>([]);
  const [allow, setAllow]       = useState<string[]>([]);
  const [review, setReview]     = useState<string[]>([]);
  const [rateLimit, setRateLimit] = useState<number>(10);
  const [loading, setLoading]   = useState(false);
  const [saved, setSaved]       = useState(false);
  const [adding, setAdding]     = useState(false);
  const [added, setAdded]       = useState(false);
  const [addErr, setAddErr]     = useState('');

  const tabs: PanelTab[] = ['Guardrails', 'HITL', ...(ffInsights ? ['Insights' as PanelTab] : [])];
  const top = insight?.top_pattern ?? null;

  const handleAddToDeny = async () => {
    if (!agentId || !top || added) return;
    setAdding(true); setAddErr('');
    try {
      const res = await fetch('/api/guardrails', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: agentId, tool_name: top.tool_name }),
      });
      if (!res.ok) { const d = await res.json() as { error?: string }; throw new Error(d.error ?? 'Failed'); }
      setAdded(true);
    } catch (e) {
      setAddErr(e instanceof Error ? e.message : 'Failed to add rule');
    } finally {
      setAdding(false);
    }
  };

  useEffect(() => {
    if (!agentId) return;
    setLoading(true);
    fetch(`/api/guardrails?agent_id=${agentId}`)
      .then(r => r.json())
      .then((g: { guardrails?: Guardrail[] }) => {
        const gr = g.guardrails?.[0] ?? null;
        setGuardrail(gr);
        setDeny(gr?.deny_patterns  ?? []);
        setAllow(gr?.allow_patterns ?? []);
        setReview([]);
        setRateLimit(gr?.max_calls_per_min ?? 10);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [agentId]);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-0">

      {/* Tabs */}
      <div className="px-4 pt-3 border-b border-slate-100 flex items-center gap-1 shrink-0">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-3 py-1.5 rounded-t-lg text-xs font-semibold transition-colors', tab === t ? 'bg-white border-x border-t border-slate-200 text-slate-800 -mb-px' : 'text-slate-400 hover:text-slate-600')}>
            {t === 'Insights' ? (
              <span className="flex items-center gap-1">
                Insights
                <span className="text-[8px] font-bold uppercase tracking-wider px-1 py-0.5 rounded bg-violet-100 text-violet-600">Labs</span>
              </span>
            ) : t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4 min-h-0">
        {tab === 'Guardrails' ? (
          loading ? (
            <div className="text-center py-8 text-xs text-slate-400">Loading…</div>
          ) : !agentId ? (
            <div className="text-center py-8 text-xs text-slate-400">Select an agent to view guardrails</div>
          ) : (
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold text-red-500 uppercase tracking-wider">DENY</p>
                  <p className="text-[9px] text-slate-400">Auto-blocked</p>
                </div>
                <EditableChips items={deny} color="red" onAdd={v => setDeny(p => [...p, v])} onRemove={v => setDeny(p => p.filter(x => x !== v))} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">REVIEW</p>
                  <p className="text-[9px] text-slate-400">Requires HITL</p>
                </div>
                <EditableChips items={review} color="amber" onAdd={v => setReview(p => [...p, v])} onRemove={v => setReview(p => p.filter(x => x !== v))} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">ALLOW</p>
                  <p className="text-[9px] text-slate-400">Auto-permitted</p>
                </div>
                <EditableChips items={allow} color="emerald" onAdd={v => setAllow(p => [...p, v])} onRemove={v => setAllow(p => p.filter(x => x !== v))} />
              </div>

              <div className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <p className="text-xs text-slate-500">Rate limit</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number" value={rateLimit} min={1} max={1000}
                    onChange={e => setRateLimit(Number(e.target.value))}
                    className="w-14 text-xs font-bold text-slate-800 text-right bg-transparent border-b border-slate-300 focus:outline-none focus:border-violet-400"
                  />
                  <span className="text-xs text-slate-400">calls/min</span>
                </div>
              </div>

              <button onClick={handleSave}
                className={cn('w-full text-xs font-semibold py-2 rounded-xl border transition-colors', saved ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-100')}>
                {saved ? '✓ Rules saved' : 'Save changes'}
              </button>
            </div>
          )
        ) : tab === 'HITL' ? (
          /* HITL tab */
          <div className="space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-amber-800">Human-in-the-Loop</p>
                  <p className="text-[11px] text-amber-600 mt-0.5">Always enabled for this demo</p>
                </div>
                <div className="relative inline-flex h-5 w-9 rounded-full bg-amber-500 cursor-not-allowed opacity-80">
                  <span className="inline-block h-4 w-4 m-0.5 translate-x-4 rounded-full bg-white shadow" />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">REVIEW tools trigger HITL</p>
              {review.map(tool => (
                <div key={tool} className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="font-mono text-xs text-slate-700 flex-1">{tool}</span>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 rounded px-1.5 py-0.5">REVIEW</span>
                </div>
              ))}
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">Capabilities</p>
              {[
                { label: 'Approve / Deny actions', on: true },
                { label: 'See full tool input',    on: true },
                { label: 'Risk level + CVSS',      on: true },
                { label: 'Authentication required',on: false },
              ].map(({ label, on }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className={cn('text-[9px] font-bold', on ? 'text-emerald-600' : 'text-slate-400')}>{on ? '✓' : '–'}</span>
                  <span className={cn('text-[11px]', on ? 'text-slate-700' : 'text-slate-400')}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Insights tab */
          <div className="space-y-3">
            {!agentId ? (
              <p className="text-xs text-slate-400 text-center py-4">Select an agent to view insights</p>
            ) : !top ? (
              <p className="text-xs text-slate-400 text-center py-4">No analysis yet — click Analyze below</p>
            ) : (
              <>
                {insight && (
                  <p className="text-[10px] text-slate-400">Last analysis {formatTimeAgo(insight.created_at, Date.now())}</p>
                )}
                {/* Top pattern card */}
                <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <code className="font-mono text-xs font-bold text-slate-800">{top.tool_name}</code>
                    <span className="text-[10px] font-semibold bg-slate-200 text-slate-600 rounded px-1.5 py-0.5">×{top.blocked_count}</span>
                    {top.severity && (
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', SEVERITY_STYLE[top.severity])}>
                        {top.severity}
                      </span>
                    )}
                    {insight?.recurring_tool_names.includes(top.tool_name) && (
                      <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 rounded px-1.5 py-0.5">Recurring</span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">{top.suggestion}</p>
                </div>

                {/* Recurring summary */}
                {insight && insight.recurring_tool_names.length > 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3" /></svg>
                    {insight.recurring_tool_names.length} tool{insight.recurring_tool_names.length > 1 ? 's' : ''} recurring from prior analysis
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={handleAddToDeny}
                    disabled={adding || added}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 rounded-xl text-xs font-semibold py-2 transition-colors',
                      added  ? 'bg-emerald-50 border border-emerald-200 text-emerald-600' :
                      addErr ? 'bg-red-50 border border-red-200 text-red-600' :
                      adding ? 'bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed' :
                               'bg-red-50 border border-red-200 text-red-700 hover:bg-red-100',
                    )}
                  >
                    {added  ? <><Icon.Check /> Added to DENY</> :
                     addErr ? addErr :
                     adding ? 'Adding…' :
                              <><Icon.Lock /> Add to DENY</>}
                  </button>
                  <Link
                    href={`/agents/${agentId}`}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 hover:bg-violet-100 transition-colors whitespace-nowrap"
                  >
                    <Icon.Report /> View analysis
                  </Link>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer: analyze button */}
      {tab === 'Guardrails' && agentId && (
        <div className="px-4 py-3 border-t border-slate-100 shrink-0">
          <AnalyzeButton agentId={agentId} />
        </div>
      )}
    </motion.div>
  );
}

// ── Agent selector ─────────────────────────────────────────────────────────────
function AgentSelector({ agents, selectedId, onSelect }: { agents: AgentStat[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = agents.find(a => a.id === selectedId);
  if (agents.length === 0) return null;
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-colors text-sm">
        <span className="h-2 w-2 rounded-full bg-violet-600" />
        <span className="text-slate-700 font-medium">{selected?.name ?? 'Select agent'}</span>
        <Icon.ChevronDown />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-20 w-56 rounded-xl border border-slate-200 bg-white shadow-lg py-1">
          {agents.map(a => (
            <button key={a.id} onClick={() => { onSelect(a.id); setOpen(false); }}
              className={cn('w-full text-left px-4 py-2 text-sm hover:bg-slate-50 flex items-center gap-2', a.id === selectedId ? 'text-violet-600 font-semibold' : 'text-slate-700')}>
              <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', a.id === selectedId ? 'bg-violet-600' : 'bg-slate-300')} />
              <span className="truncate">{a.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Auto-scheduler demo types ─────────────────────────────────────────────────
const DEMO_TYPES = ['research', 'hr', 'devops', 'finance', 'support'] as const;
type DemoType = typeof DEMO_TYPES[number];

// ── Dashboard client ──────────────────────────────────────────────────────────
export default function DashboardClient() {
  const [now, setNow]                       = useState(() => Date.now());
  const [feed, setFeed]                     = useState<DisplayEntry[]>([]);
  const [agentStats, setAgentStats]         = useState<AgentStat[]>([]);
  const [agentNameMap, setAgentNameMap]     = useState<Record<string, string>>({});
  const [isLoading, setIsLoading]           = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [hitlPending, setHitlPending]       = useState<HitlRequest[]>([]);
  const [runStatus, setRunStatus]           = useState<RunStatus>({ online: false, running: false });
  // Persist sessions + epoch across navigations (cleared only on onboarding reset)
  const [sessions, setSessions] = useState<Session[]>(() => {
    try { return JSON.parse(sessionStorage.getItem('alc_sessions') ?? '[]') as Session[]; } catch { return []; }
  });
  const [activeSessionId, setActiveSessionId] = useState<string>('all');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry]   = useState<DisplayEntry | null>(null);
  const [reportToast, setReportToast]       = useState<{ href: string } | null>(null);
  // Feature flags (persisted in localStorage)
  const [ffCompare,    setFfCompare]    = useState(() => typeof window !== 'undefined' && localStorage.getItem('ff_compare')     === 'true');
  const [ffAttackPath, setFfAttackPath] = useState(() => typeof window !== 'undefined' && localStorage.getItem('ff_attack_path') === 'true');
  const [ffInsights,   setFfInsights]   = useState(() => typeof window !== 'undefined' && localStorage.getItem('ff_insights')    === 'true');
  const [ffPanelOpen,  setFfPanelOpen]  = useState(false);
  const [attackPathOpen, setAttackPathOpen] = useState(false);
  const toggleFf = (key: string, setter: React.Dispatch<React.SetStateAction<boolean>>) => (v: boolean) => {
    localStorage.setItem(key, String(v)); setter(v);
  };
  const prevRunning  = useRef(false);
  const feedRef      = useRef<DisplayEntry[]>([]);
  // Epoch = timestamp of first Run click; only events after this are shown
  const sessionEpoch = useRef<string | null>(sessionStorage.getItem('alc_epoch'));

  // Derived stats
  const totalCalls   = agentStats.reduce((s, a) => s + a.totalCalls,   0);
  const totalBlocked = agentStats.reduce((s, a) => s + a.blockedCalls, 0);
  const blockRate    = totalCalls > 0 ? (totalBlocked / totalCalls) * 100 : 0;
  const activeCount  = agentStats.filter(a => a.lastActive && now - new Date(a.lastActive).getTime() < 300_000).length;

  const currentSession = sessions.find(s => s.id === activeSessionId);
  const sessionStartMs = currentSession ? new Date(currentSession.startedAt).getTime()
    : (runStatus.started_at ? new Date(runStatus.started_at).getTime() : null);

  const sessionFeed = useMemo(() => {
    if (!sessionStartMs) return [];
    return feed.filter(e => new Date(e.created_at).getTime() >= sessionStartMs);
  }, [feed, sessionStartMs]);

  const displayFeed = useMemo(() => {
    if (activeSessionId === 'all') return feed;
    const session = sessions.find(s => s.id === activeSessionId);
    if (!session) return feed;
    const start = new Date(session.startedAt).getTime();
    const end   = session.endedAt ? new Date(session.endedAt).getTime() : Infinity;
    return feed.filter(e => { const t = new Date(e.created_at).getTime(); return t >= start && t <= end; });
  }, [feed, sessions, activeSessionId]);

  // Helper: convert raw requests into DisplayEntry[]
  // hitlAll contains decided (approved/denied) HITL entries — used to resolve
  // feed entries that still have payload.hitl='pending' because the requests
  // table is never patched when a decision is made (only hitl_requests is).
  const buildDisplayFeed = useCallback((
    requests: Array<{ id: string; agent_id: string; tool_name: string; status: string; severity: string | null; payload: Record<string,unknown>|null; created_at: string }>,
    hitlAll: HitlRequest[],
  ): DisplayEntry[] => {
    // For each decided HITL request, index by agent_id:tool_name:time-bucket (30s)
    // so we can resolve stale payload.hitl='pending' entries in the feed.
    const resolvedHitl = new Map<string, 'approved' | 'denied'>();
    for (const h of hitlAll) {
      if (h.status === 'approved' || h.status === 'denied') {
        const bucket = Math.floor(new Date(h.created_at).getTime() / 30_000);
        resolvedHitl.set(`${h.agent_id}:${h.tool_name}:${bucket}`, h.status);
        // Also store without bucket so a single pending entry always resolves
        resolvedHitl.set(`${h.agent_id}:${h.tool_name}`, h.status);
      }
    }

    return requests
      .map(r => {
        let hitlDecision = hitlDecisionFromPayload(r.payload);
        // If the payload still says 'pending', check hitlAll for a real decision
        if (hitlDecision === 'pending') {
          const bucket = Math.floor(new Date(r.created_at).getTime() / 30_000);
          const resolved =
            resolvedHitl.get(`${r.agent_id}:${r.tool_name}:${bucket}`) ??
            resolvedHitl.get(`${r.agent_id}:${r.tool_name}`);
          if (resolved) hitlDecision = resolved;
        }
        let displayStatus: DisplayStatus;
        if      (hitlDecision === 'approved') displayStatus = 'ALLOWED';
        else if (hitlDecision === 'pending')  displayStatus = 'REVIEW';
        else if (hitlDecision === 'denied')   displayStatus = 'BLOCKED';
        else                                  displayStatus = r.status as DisplayStatus;
        return {
          id: r.id, agent_id: r.agent_id, tool_name: r.tool_name,
          displayStatus,
          severity: r.severity, payload: r.payload, created_at: r.created_at,
          isHitl: Boolean(hitlDecision),
          hitlDecision,
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, []);

  // Keep feedRef in sync so the run-completion handler can read current feed
  useEffect(() => { feedRef.current = feed; }, [feed]);

  // Keep sessionStorage in sync
  useEffect(() => {
    sessionStorage.setItem('alc_sessions', JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (selectedAgentId === null && agentStats.length > 0) setSelectedAgentId(agentStats[0].id);
  }, [agentStats, selectedAgentId]);

  useEffect(() => { if (runStatus.agent_id) setSelectedAgentId(runStatus.agent_id); }, [runStatus.agent_id]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

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
        setFeed([]); // feed starts empty; populated by polling after first Run click
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

  // Primary live feed: HTTP polling every 2 s
  // (Realtime is unreliable due to RLS on anon key — polling is the source of truth)
  const pollFeed = useCallback(async () => {
    if (!sessionEpoch.current) return;
    try {
      const epoch = sessionEpoch.current;
      const [reqRes, hitlRes, hitlAllRes] = await Promise.all([
        fetch(`/api/requests?limit=500&since=${encodeURIComponent(epoch)}`).then(r => r.json()) as Promise<{ requests?: Array<{ id: string; agent_id: string; tool_name: string; status: string; severity: string|null; payload: Record<string,unknown>|null; created_at: string }> }>,
        fetch('/api/hitl').then(r => r.json()) as Promise<{ hitl_requests?: HitlRequest[] }>,
        fetch(`/api/hitl?since=${encodeURIComponent(epoch)}`).then(r => r.json()) as Promise<{ hitl_requests?: HitlRequest[] }>,
      ]);
      const requests = reqRes.requests ?? [];
      const hitlPendingList = hitlRes.hitl_requests ?? [];
      const hitlAll  = hitlAllRes.hitl_requests ?? [];

      setHitlPending(hitlPendingList);

      // Rebuild full feed from current session (requests + all HITL including decided)
      const newFeed = buildDisplayFeed(requests, hitlAll);
      setFeed(newFeed);

      // Recompute agentStats from scratch (not incrementally) to avoid double-counting
      setAgentStats(prev => {
        // Build a stats map from the current full request list
        const statsMap = new Map<string, { total: number; blocked: number; lastActive: string | null }>();
        for (const r of requests) {
          const cur = statsMap.get(r.agent_id) ?? { total: 0, blocked: 0, lastActive: null };
          statsMap.set(r.agent_id, {
            total:      cur.total + 1,
            blocked:    cur.blocked + (isBlockedRequest(r.status, r.payload) ? 1 : 0),
            lastActive: r.created_at,
          });
        }
        const knownIds = new Set(prev.map(a => a.id));
        const updated = prev.map(agent => {
          const s = statsMap.get(agent.id);
          return s
            ? { ...agent, totalCalls: s.total, blockedCalls: s.blocked, lastActive: s.lastActive }
            : { ...agent, totalCalls: 0, blockedCalls: 0 };
        });
        // Agents seen in requests but not yet in the list
        for (const [agentId, s] of statsMap) {
          if (!knownIds.has(agentId)) {
            updated.push({ id: agentId, name: agentId, totalCalls: s.total, blockedCalls: s.blocked, lastActive: s.lastActive, latestInsight: null });
          }
        }
        return updated;
      });
      setAgentNameMap(prev => {
        const next = { ...prev };
        for (const r of requests) { if (!next[r.agent_id]) next[r.agent_id] = r.agent_id; }
        return next;
      });
    } catch { /* ignore network errors */ }
  }, [buildDisplayFeed]);

  useEffect(() => {
    // Immediate fetch on mount if we already have an epoch (returning from another page)
    void pollFeed();
    const interval = setInterval(pollFeed, 2000);
    return () => clearInterval(interval);
  }, [pollFeed]);

  // Secondary: Realtime as bonus (best-effort, may be blocked by RLS)
  useEffect(() => {
    const channel = supabase.channel('dashboard-requests')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'requests' }, () => {
        // Realtime triggers an immediate poll refresh — no processing here
        // (the interval above will pick it up within 2 s anyway)
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Poll: run status + detect run completion
  useEffect(() => {
    const poll = setInterval(async () => {
      try {
        const runRes = await fetch('/api/run').then(r => r.json()) as RunStatus;
        setRunStatus(runRes);

        if (prevRunning.current && !runRes.running) {
          setSessions(prev => {
            const lastIdx = prev.length - 1;
            const last = prev[lastIdx];
            if (!last || last.endedAt) return prev;

            const startMs  = new Date(last.startedAt).getTime();
            const endedAt  = new Date().toISOString();
            const endMs    = new Date(endedAt).getTime();
            const hasEvents = feedRef.current.some(e => {
              const t = new Date(e.created_at).getTime();
              return t >= startMs && t <= endMs;
            });

            // Discard runs that produced no tool calls — nothing to report
            if (!hasEvents) return prev.filter((_, i) => i !== lastIdx);

            const updated = prev.map((s, i) => i === lastIdx ? { ...s, endedAt } : s);
            setReportToast({ href: `/report?from=${encodeURIComponent(last.startedAt)}&to=${encodeURIComponent(endedAt)}` });
            return updated;
          });
        }
        prevRunning.current = runRes.running;
      } catch { /* ignore */ }
    }, 3000);
    return () => clearInterval(poll);
  }, []);

  const startAgent = useCallback(async (demo: DemoType): Promise<void> => {
    try {
      const res = await fetch(`/api/run?demo=${demo}`, { method: 'POST' });
      if (!res.ok) return; // 409 = already at max concurrent, silently skip
      const startedAt = new Date().toISOString();
      if (!sessionEpoch.current) {
        sessionEpoch.current = startedAt;
        sessionStorage.setItem('alc_epoch', startedAt);
      }
      const newSession: Session = { id: crypto.randomUUID(), n: sessions.length + 1, startedAt };
      setSessions(prev => [...prev, newSession]);
      setActiveSessionId('all'); // switch to "all" view when a new run starts
      setRunStatus(prev => ({ ...prev, running: true, started_at: startedAt }));
      prevRunning.current = true;
    } catch { /* agent server offline — scheduler will retry later */ }
  }, [sessions.length]);

  const handleHitlDecide = useCallback(async (id: string, status: 'approved' | 'denied') => {
    await fetch(`/api/hitl/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    setHitlPending(prev => prev.filter(r => r.id !== id));
    // Immediately re-poll so the feed reflects the decision without waiting 2s
    void pollFeed();
  }, [pollFeed]);

  // Auto-scheduler: fires 1 agent on mount, then one at a time every 45–75 s.
  // Fallback watchdog triggers if nothing has run for >120 s.
  const lastRunAt = useRef<number>(0);
  const schedulerActive = useRef(false);

  useEffect(() => {
    if (schedulerActive.current) return;
    schedulerActive.current = true;

    const pickDemo = (): DemoType => DEMO_TYPES[Math.floor(Math.random() * DEMO_TYPES.length)];
    const randomDelay = () => 45_000 + Math.random() * 30_000; // 45–75 s

    // Fire 1 agent on mount
    const fireInitial = async () => {
      await startAgent(pickDemo());
      lastRunAt.current = Date.now();
    };

    // After each interval, fire one agent
    const scheduleNext = () => {
      const delay = randomDelay();
      return setTimeout(async () => {
        await startAgent(pickDemo());
        lastRunAt.current = Date.now();
        nextTimer = scheduleNext();
      }, delay);
    };

    // Watchdog: if nothing has run in 120 s, force one
    const watchdog = setInterval(() => {
      if (Date.now() - lastRunAt.current > 120_000) {
        void startAgent(pickDemo());
        lastRunAt.current = Date.now();
      }
    }, 15_000);

    let nextTimer: ReturnType<typeof setTimeout>;

    void fireInitial().then(() => {
      nextTimer = scheduleNext();
    });

    return () => {
      clearInterval(watchdog);
      clearTimeout(nextTimer);
    };
  }, [startAgent]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedAgent   = agentStats.find(a => a.id === selectedAgentId) ?? null;
  const sessionAgentName = runStatus.agent_id ? (agentNameMap[runStatus.agent_id] ?? null) : null;

  return (
    <div className="flex flex-col h-screen bg-slate-50">

      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="shrink-0 bg-white border-b border-slate-200 px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm bg-[linear-gradient(135deg,#6965f4_0%,#5b7dff_100%)]">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-[-0.05em]">Alcatraz</span>
          </div>
          <div className="w-px h-5 bg-slate-200" />
          <AgentSelector agents={agentStats} selectedId={selectedAgentId} onSelect={setSelectedAgentId} />
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" /></span>
            <span className="text-xs font-medium text-emerald-600">Live</span>
          </div>
          <div className="w-px h-5 bg-slate-200" />
          {/* Labs FF toggle */}
          <div className="relative">
            <button
              onClick={() => setFfPanelOpen(o => !o)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-colors',
                (ffCompare || ffAttackPath || ffInsights)
                  ? 'border-violet-300 bg-violet-50 text-violet-700'
                  : 'border-slate-200 hover:border-slate-300 text-slate-500 hover:text-slate-700',
              )}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
              </svg>
              Labs
              {(ffCompare || ffAttackPath || ffInsights) && <span className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />}
            </button>
            {ffPanelOpen && (
              <div className="absolute top-full right-0 mt-1.5 z-30 w-68 rounded-xl border border-slate-200 bg-white shadow-xl p-3 space-y-1.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 mb-2">Experimental</p>
                {([
                  { key: 'ff_compare',     label: 'Side-by-side comparison',    desc: 'Unprotected vs protected feeds',  val: ffCompare,    set: toggleFf('ff_compare',     setFfCompare) },
                  { key: 'ff_attack_path', label: 'Run workflow visualization',  desc: 'View run as a flow diagram',      val: ffAttackPath, set: toggleFf('ff_attack_path', setFfAttackPath) },
                  { key: 'ff_insights',    label: 'Insights panel',              desc: 'Top pattern + quick DENY action', val: ffInsights,   set: toggleFf('ff_insights',    setFfInsights) },
                ] as const).map(({ label, desc, val, set }) => (
                  <button key={label} onClick={() => set(!val)}
                    className={cn('w-full text-left flex items-start gap-3 px-3 py-2.5 rounded-lg border transition-colors',
                      val ? 'border-violet-200 bg-violet-50' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                    )}
                  >
                    <div className={cn('mt-0.5 relative h-4 w-7 rounded-full transition-colors shrink-0', val ? 'bg-violet-500' : 'bg-slate-200')}>
                      <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform', val ? 'translate-x-3.5' : 'translate-x-0.5')} />
                    </div>
                    <div>
                      <p className={cn('text-xs font-semibold', val ? 'text-violet-700' : 'text-slate-600')}>{label}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">{desc}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Link href="/onboarding" className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 text-xs font-semibold text-slate-600 hover:text-slate-800 transition-colors">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
            Onboarding
          </Link>
        </div>
      </motion.header>

      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full max-w-[1440px] mx-auto px-8 py-6 flex flex-col gap-5">

          {/* KPI row */}
          <div className="grid grid-cols-4 gap-5 shrink-0">
            <KpiCard label="Total Requests"  value={totalCalls.toLocaleString()}         sub="Across all agents"                                             accent="blue"                                                                       icon={<Icon.Activity />} delay={0.1} />
            <KpiCard label="Threats Blocked" value={totalBlocked.toLocaleString()}       sub={`${blockRate.toFixed(1)}% of all traffic`}                     accent="red"                                                                        icon={<Icon.Shield />}   delay={0.17} />
            <KpiCard label="Block Rate"      value={`${blockRate.toFixed(1)}%`}          sub={blockRate > 3 ? 'Elevated — review recommended' : 'Within normal range'} accent={blockRate > 10 ? 'red' : blockRate > 3 ? 'amber' : 'green'}  icon={<Icon.Percent />}  delay={0.24} />
            <KpiCard label="Active Agents"   value={`${activeCount} / ${agentStats.length}`} sub="Active in the last 5 min"                                  accent="green"                                                                      icon={<Icon.Users />}    delay={0.31} />
          </div>

          {/* Main body */}
          <div className="grid grid-cols-[1fr_300px] gap-5 flex-1 min-h-0">

            {/* Live feed */}
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.36, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

              <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Live Feed</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {activeSessionId === 'all' ? `${feed.length} total events` : `${displayFeed.length} events in this run`}
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  {ffAttackPath && displayFeed.length > 0 && (
                    <button
                      onClick={() => setAttackPathOpen(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-50 border border-violet-200 text-violet-700 text-[11px] font-semibold hover:bg-violet-100 transition-colors"
                    >
                      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="5" cy="12" r="2" /><circle cx="12" cy="5" r="2" /><circle cx="19" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                        <line x1="7" y1="12" x2="10" y2="12" /><line x1="14" y1="12" x2="17" y2="12" />
                        <line x1="12" y1="7" x2="12" y2="10" /><line x1="12" y1="14" x2="12" y2="17" />
                      </svg>
                      Run Workflow
                    </button>
                  )}
                  <span className="relative flex h-1.5 w-1.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75" /><span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-500" /></span>
                  <span className="text-xs font-medium text-violet-600">Realtime</span>
                </div>
              </div>

              {sessions.length > 0 && <SessionTabs sessions={sessions} activeId={activeSessionId} onSelect={setActiveSessionId} />}

              {!ffCompare && (
                <div className="shrink-0 grid grid-cols-[8px_1fr_80px_90px_56px] gap-0 items-center px-5 py-2 bg-slate-50 border-b border-slate-100 text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  <span /><span className="px-3">Tool · Payload</span><span>Agent</span><span>Status</span><span className="text-right">Time</span>
                </div>
              )}

              <div className={cn('flex-1 min-h-0', ffCompare ? 'overflow-hidden' : 'overflow-y-auto')}>
                {ffCompare ? (
                  <CompareFeeds
                    feed={displayFeed}
                    isLoading={isLoading}
                    sessionHasStarted={!!sessionEpoch.current}
                  />
                ) : isLoading ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16"><div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-4"><Icon.Activity /></div><p className="text-sm font-medium text-slate-600">Loading feed</p></div>
                ) : error ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16 px-6"><div className="w-12 h-12 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mb-4"><Icon.Shield /></div><p className="text-sm font-medium text-slate-700">Dashboard load failed</p><p className="text-xs text-slate-400 mt-1">{error}</p></div>
                ) : displayFeed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mb-4"><Icon.Activity /></div>
                    <p className="text-sm font-medium text-slate-600">{activeSessionId === 'all' ? 'No events yet' : 'No events in this run'}</p>
                    <p className="text-xs text-slate-400 mt-1 max-w-[220px]">
                      {sessionEpoch.current ? 'Agent is starting — events will appear here in real time' : 'Agents are starting — tool calls will stream here in real time'}
                    </p>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout" initial={false}>
                    {displayFeed.map(entry => (
                      <motion.div key={entry.id} initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: 'easeOut' }} layout="position">
                        <LogRow entry={entry} agentName={agentNameMap[entry.agent_id] ?? entry.agent_id.slice(0, 8)} onClick={() => setSelectedEntry(entry)} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>

            {/* Right panel */}
            <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
              <div className="flex-1 min-h-0 flex flex-col">
                <GuardrailsPanel agentId={selectedAgentId} insight={selectedAgent?.latestInsight} ffInsights={ffInsights} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals + toasts */}
      <AnimatePresence>
        {hitlPending.length > 0 && <HitlPanel requests={hitlPending} agentNameMap={agentNameMap} onDecide={handleHitlDecide} />}
      </AnimatePresence>

      <AnimatePresence>
        {selectedEntry && (
          <LogEntryModal entry={selectedEntry} agentName={agentNameMap[selectedEntry.agent_id] ?? selectedEntry.agent_id.slice(0, 8)} onClose={() => setSelectedEntry(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {reportToast && <ReportReadyToast href={reportToast.href} onClose={() => setReportToast(null)} />}
      </AnimatePresence>

      <AnimatePresence>
        {ffAttackPath && attackPathOpen && (
          <AttackPathModal entries={displayFeed} onClose={() => setAttackPathOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
