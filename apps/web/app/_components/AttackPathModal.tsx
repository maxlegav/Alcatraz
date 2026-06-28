'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';

type DisplayStatus = 'ALLOWED' | 'BLOCKED' | 'REVIEW';

export type AttackEntry = {
  id: string;
  tool_name: string;
  displayStatus: DisplayStatus;
  severity: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
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

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function cvssRange(severity: string | null): string {
  if (severity === 'critical') return '9.0–10.0';
  if (severity === 'high')     return '7.0–8.9';
  if (severity === 'medium')   return '4.0–6.9';
  return '0.1–3.9';
}

const S = {
  ALLOWED: { node: 'bg-emerald-50 border-emerald-300', badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', ring: 'ring-emerald-400' },
  BLOCKED: { node: 'bg-red-50 border-red-400',         badge: 'bg-red-100 text-red-700',         dot: 'bg-red-500',     ring: 'ring-red-400'     },
  REVIEW:  { node: 'bg-amber-50 border-amber-300',     badge: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500',   ring: 'ring-amber-400'   },
} as const;

const SEV_STYLE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-orange-100 text-orange-700',
  medium:   'bg-amber-100 text-amber-700',
  low:      'bg-slate-100 text-slate-500',
};

function DetailPanel({ entry, index, onClose }: { entry: AttackEntry; index: number; onClose: () => void }) {
  const s = S[entry.displayStatus];
  const hint = extractHint(entry.payload);
  const cleanPayload = entry.payload
    ? Object.fromEntries(Object.entries(entry.payload).filter(([k]) => k !== 'hitl'))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className="mt-5 rounded-2xl border border-slate-200 bg-white overflow-hidden"
    >
      {/* Detail header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Step {index + 1}</span>
          <span className="text-[9px] text-slate-300">·</span>
          <span className={cn('text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', s.badge)}>
            {entry.displayStatus}
          </span>
          {entry.severity && (
            <span className={cn('text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', SEV_STYLE[entry.severity] ?? SEV_STYLE.low)}>
              {entry.severity}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-5">
        {/* Tool + meta */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Tool</p>
            <p className="font-mono text-lg font-bold text-slate-800">{entry.tool_name}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Timestamp</p>
            <p className="font-mono text-sm text-slate-600">{formatTime(entry.created_at)}</p>
          </div>
        </div>

        {/* CVSS / severity row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">CVSS Range</p>
            <p className="text-sm font-bold text-slate-700">{cvssRange(entry.severity)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Severity</p>
            <p className="text-sm font-bold text-slate-700 capitalize">{entry.severity ?? 'N/A'}</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
            <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-1">Decision</p>
            <p className={cn('text-sm font-bold', entry.displayStatus === 'BLOCKED' ? 'text-red-600' : entry.displayStatus === 'REVIEW' ? 'text-amber-600' : 'text-emerald-600')}>
              {entry.displayStatus}
            </p>
          </div>
        </div>

        {/* Hint */}
        {hint && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Key Parameter</p>
            <p className="font-mono text-sm text-slate-700 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2 break-all">{hint}</p>
          </div>
        )}

        {/* Full payload */}
        {cleanPayload && Object.keys(cleanPayload).length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Full Payload</p>
            <pre className="text-[11px] font-mono text-slate-600 bg-slate-50 rounded-lg border border-slate-200 px-3 py-2.5 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap">
              {JSON.stringify(cleanPayload, null, 2)}
            </pre>
          </div>
        )}

        {/* Block / review reason */}
        {entry.displayStatus === 'BLOCKED' && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-red-500 mb-1">Block Reason</p>
            <p className="text-xs text-red-700">
              {entry.tool_name === 'prompt_injection'
                ? 'Prompt injection detected in tool input — auto-blocked by security engine.'
                : 'Tool matched a DENY rule configured for this agent.'}
            </p>
          </div>
        )}
        {entry.displayStatus === 'REVIEW' && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2.5">
            <p className="text-[9px] font-bold uppercase tracking-wider text-amber-600 mb-1">Pending Human Review</p>
            <p className="text-xs text-amber-800">This tool is in the REVIEW list — a human must approve or deny before execution proceeds.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function AttackPathModal({
  entries,
  onClose,
}: {
  entries: AttackEntry[];
  onClose: () => void;
}) {
  const sorted = [...entries].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIndex = sorted.findIndex(e => e.id === selectedId);
  const selectedEntry = selectedIndex >= 0 ? sorted[selectedIndex] : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
        className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-5xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div>
            <h2 className="text-sm font-bold text-slate-800">Run Workflow</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {sorted.length} tool call{sorted.length !== 1 ? 's' : ''} · click any step to inspect
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3 text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />Allowed</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />Blocked</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />Review</span>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Flow + detail */}
        <div className="p-6 overflow-y-auto max-h-[75vh]">
          {sorted.length === 0 ? (
            <p className="text-center text-sm text-slate-400 py-8">No tool calls to display yet.</p>
          ) : (
            <>
              {/* Flow diagram */}
              <div className="overflow-x-auto pb-2">
                <div className="flex items-center gap-0 min-w-max">
                  {sorted.map((entry, i) => {
                    const s = S[entry.displayStatus];
                    const hint = extractHint(entry.payload);
                    const isSelected = entry.id === selectedId;
                    return (
                      <div key={entry.id} className="flex items-center">
                        <motion.div
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.07, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                          onClick={() => setSelectedId(isSelected ? null : entry.id)}
                          className={cn(
                            'relative flex flex-col rounded-2xl border-2 p-4 w-44 cursor-pointer transition-all select-none',
                            s.node,
                            isSelected ? `ring-2 ring-offset-1 ${s.ring} shadow-md` : 'hover:shadow-sm hover:-translate-y-0.5',
                          )}
                        >
                          <div className="flex items-center justify-between mb-2.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Step {i + 1}</span>
                            <span className={cn('w-2 h-2 rounded-full', s.dot)} />
                          </div>

                          <p className="font-mono text-[13px] font-bold text-slate-800 truncate mb-2">{entry.tool_name}</p>

                          {hint && (
                            <p className="text-[10px] font-mono text-slate-400 truncate mb-2">{hint}</p>
                          )}

                          <span className={cn('self-start text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full', s.badge)}>
                            {entry.displayStatus}
                          </span>

                          {entry.severity && entry.displayStatus === 'BLOCKED' && (
                            <span className="mt-1 self-start text-[9px] font-semibold text-red-500 uppercase tracking-wider">
                              {entry.severity}
                            </span>
                          )}
                        </motion.div>

                        {i < sorted.length - 1 && (
                          <div className="flex items-center px-1 shrink-0">
                            <svg width="36" height="16" viewBox="0 0 36 16" fill="none">
                              <line x1="0" y1="8" x2="26" y2="8" stroke="#cbd5e1" strokeWidth="1.5" />
                              <polyline points="22,4 30,8 22,12" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Detail panel */}
              <AnimatePresence>
                {selectedEntry && (
                  <DetailPanel
                    key={selectedEntry.id}
                    entry={selectedEntry}
                    index={selectedIndex}
                    onClose={() => setSelectedId(null)}
                  />
                )}
              </AnimatePresence>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
