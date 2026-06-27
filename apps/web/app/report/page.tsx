'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Suspense } from 'react';

type RequestRow = { id: string; status: string; tool_name: string; created_at: string; severity?: string };
type SessionStats = { total: number; allowed: number; blocked: number; hitl: number; blockedTools: string[] };

const HITL_TOOLS = new Set(['database_query', 'send_report']);

function StatBox({ label, value, color }: { label: string; value: number | string; color: string }) {
  const colors: Record<string, string> = {
    blue:    'bg-blue-950 border-blue-800 text-blue-400',
    emerald: 'bg-emerald-950 border-emerald-800 text-emerald-400',
    red:     'bg-red-950 border-red-800 text-red-400',
    amber:   'bg-amber-950 border-amber-800 text-amber-400',
  };
  return (
    <div className={cn('rounded-2xl border p-4 text-center', colors[color])}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-[11px] font-medium opacity-70 mt-1">{label}</p>
    </div>
  );
}

function CoverageRow({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={cn('h-4 w-4 rounded-full flex items-center justify-center text-[10px] shrink-0', done ? 'bg-emerald-900 text-emerald-400' : 'bg-slate-800 text-slate-600')}>
        {done ? '✓' : '–'}
      </span>
      <span className={cn('text-sm', done ? 'text-slate-300' : 'text-slate-500')}>{label}</span>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function SEV_COLOR(sev: string | undefined) {
  const map: Record<string, string> = {
    critical: 'bg-red-950 text-red-400 border-red-800',
    high:     'bg-orange-950 text-orange-400 border-orange-800',
    medium:   'bg-amber-950 text-amber-400 border-amber-800',
    low:      'bg-slate-800 text-slate-400 border-slate-700',
  };
  return map[sev ?? ''] ?? 'bg-slate-800 text-slate-400 border-slate-700';
}

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const from = searchParams.get('from');
  const to   = searchParams.get('to');

  const [stats, setStats]     = useState<SessionStats | null>(null);
  const [rows, setRows]       = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/requests?limit=500')
      .then(r => r.json())
      .then((data: { requests?: RequestRow[] }) => {
        const all = data.requests ?? [];
        const filtered = from
          ? all.filter(r => {
              const t = new Date(r.created_at).getTime();
              const start = new Date(from).getTime() - 5000;
              const end   = to ? new Date(to).getTime() + 5000 : Infinity;
              return t >= start && t <= end;
            })
          : all.slice(0, 50);

        const blocked = filtered.filter(r => r.status === 'BLOCKED');
        const hitl    = blocked.filter(r => HITL_TOOLS.has(r.tool_name));

        setRows(filtered);
        setStats({
          total:        filtered.length,
          allowed:      filtered.filter(r => r.status === 'ALLOWED').length,
          blocked:      blocked.length,
          hitl:         hitl.length,
          blockedTools: [...new Set(blocked.map(r => r.tool_name))],
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to]);

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-bold text-white tracking-tight">Alcatraz</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest">Session Report</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-xs font-semibold text-slate-400 hover:text-white transition-colors border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-lg"
          >
            ← Back to Dashboard
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3">
            <Spinner />
            <span className="text-sm text-slate-400">Loading session data…</span>
          </div>
        ) : stats ? (
          <div className="space-y-6">
            {/* KPI row */}
            <div className="grid grid-cols-4 gap-3">
              <StatBox label="Total Events" value={stats.total}   color="blue" />
              <StatBox label="Allowed"      value={stats.allowed} color="emerald" />
              <StatBox label="Blocked"      value={stats.blocked} color="red" />
              <StatBox label="HITL Reviews" value={stats.hitl}    color="amber" />
            </div>

            {/* Threats blocked */}
            {stats.blockedTools.length > 0 && (
              <div className="rounded-2xl border border-red-800 bg-red-950 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-red-400 mb-3">Threats Blocked</p>
                <div className="flex flex-wrap gap-2">
                  {stats.blockedTools.map(tool => (
                    <span key={tool} className="flex items-center gap-1.5 bg-red-900 border border-red-700 rounded-lg px-2.5 py-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
                      <span className="font-mono text-sm text-red-300">{tool}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Coverage */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Coverage</p>
              <div className="space-y-2">
                <CoverageRow label="Prompt injection detection"  done={rows.some(r => r.tool_name === 'prompt_injection')} />
                <CoverageRow label="DENY rule enforcement"       done={stats.blocked > 0} />
                <CoverageRow label="Human-in-the-loop (HITL)"   done={stats.hitl > 0} />
                <CoverageRow label="Rate limiting"               done />
                <CoverageRow label="Real-time dashboard feed"    done />
              </div>
            </div>

            {/* Event log */}
            <div className="rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Event Log</p>
                <span className="text-[11px] text-slate-500">{rows.length} events</span>
              </div>
              {rows.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-8">No events found for this session</p>
              ) : (
                <div className="divide-y divide-slate-800 max-h-80 overflow-y-auto">
                  {rows.map(r => (
                    <div key={r.id} className={cn('flex items-center gap-3 px-4 py-2.5', r.status === 'BLOCKED' ? 'bg-red-950/30' : '')}>
                      <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', r.status === 'BLOCKED' ? 'bg-red-400' : 'bg-emerald-400')} />
                      <span className="font-mono text-sm text-slate-300 flex-1 truncate">{r.tool_name}</span>
                      <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full border', SEV_COLOR(r.severity))}>
                        {r.severity ?? 'low'}
                      </span>
                      <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-lg', r.status === 'BLOCKED' ? 'bg-red-900 text-red-300' : 'bg-emerald-900 text-emerald-300')}>
                        {r.status}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono shrink-0">{formatTime(r.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        ) : (
          <div className="text-center py-24 text-slate-500 text-sm">Failed to load session data.</div>
        )}
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <span className="text-slate-400 text-sm">Loading…</span>
      </div>
    }>
      <ReportContent />
    </Suspense>
  );
}
