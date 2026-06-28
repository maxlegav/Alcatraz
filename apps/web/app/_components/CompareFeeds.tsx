'use client';

import { cn } from '@/lib/utils';
import { formatTime } from '@/lib/agent-status';

type DisplayStatus = 'ALLOWED' | 'BLOCKED' | 'REVIEW';

export type CompareEntry = {
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

function CompareRow({ entry, simulated }: { entry: CompareEntry; simulated: boolean }) {
  const blocked = !simulated && entry.displayStatus === 'BLOCKED';
  const review  = !simulated && entry.displayStatus === 'REVIEW';
  const hint    = extractHint(entry.payload);
  return (
    <div className={cn(
      'grid grid-cols-[8px_1fr_72px_44px] gap-0 px-4 py-2.5 border-b border-slate-100/80 text-xs',
      simulated ? 'hover:bg-red-50/20' :
      blocked   ? 'bg-red-50/40 hover:bg-red-50/70' :
      review    ? 'bg-amber-50/50 hover:bg-amber-50/80' :
                  'hover:bg-emerald-50/30',
    )}>
      <span className={cn('mt-0.5 h-2 w-2 rounded-full shrink-0',
        simulated ? 'bg-slate-300' :
        blocked   ? 'bg-red-400'     :
        review    ? 'bg-amber-400 animate-pulse' :
                    'bg-emerald-400'
      )} />
      <div className="min-w-0 px-2">
        <span className="font-mono font-semibold truncate block text-slate-700">{entry.tool_name}</span>
        {hint && <span className="text-[10px] text-slate-400 truncate block mt-0.5 font-mono">{hint}</span>}
      </div>
      <span className={cn(
        'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full self-start text-center',
        simulated ? 'bg-slate-100 text-slate-500' :
        blocked   ? 'bg-red-100 text-red-700'     :
        review    ? 'bg-amber-100 text-amber-700'  :
                    'bg-emerald-100 text-emerald-700'
      )}>
        {simulated ? 'ALLOWED' : entry.displayStatus}
      </span>
      <span className="text-[10px] text-slate-400 tabular-nums text-right font-mono self-center">{formatTime(entry.created_at)}</span>
    </div>
  );
}

function EmptyState({ color }: { color: 'red' | 'green' }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
      <div className={cn('h-2 w-2 rounded-full mb-3', color === 'red' ? 'bg-red-300' : 'bg-emerald-300')} />
      <p className="text-xs text-slate-400">Run the agent to see events</p>
    </div>
  );
}

export default function CompareFeeds({
  feed,
  isLoading,
  sessionHasStarted,
}: {
  feed: CompareEntry[];
  isLoading: boolean;
  sessionHasStarted: boolean;
}) {
  const blockedCount = feed.filter(e => e.displayStatus === 'BLOCKED').length;
  const showEmpty = !sessionHasStarted || (isLoading && feed.length === 0);

  return (
    <div className="grid grid-cols-2 h-full min-h-0 divide-x divide-slate-200">
      {/* Without Alcatraz */}
      <div className="flex flex-col min-h-0 overflow-hidden">
        <div className="shrink-0 px-4 py-2.5 bg-red-50 border-b border-red-100 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-red-800">Without Alcatraz</p>
            <p className="text-[10px] text-red-500 leading-none mt-0.5">Simulated — all calls execute</p>
          </div>
          <span className="shrink-0 text-[10px] font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5">
            0 blocked
          </span>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {showEmpty ? <EmptyState color="red" /> : feed.map(e => <CompareRow key={`sim-${e.id}`} entry={e} simulated />)}
        </div>
      </div>

      {/* With Alcatraz */}
      <div className="flex flex-col min-h-0 overflow-hidden">
        <div className="shrink-0 px-4 py-2.5 bg-emerald-50 border-b border-emerald-100 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-emerald-800">With Alcatraz</p>
            <p className="text-[10px] text-emerald-600 leading-none mt-0.5">Live — threats intercepted</p>
          </div>
          <span className={cn(
            'shrink-0 text-[10px] font-bold rounded px-1.5 py-0.5',
            blockedCount > 0 ? 'text-red-700 bg-red-100' : 'text-slate-500 bg-slate-100'
          )}>
            {blockedCount} blocked
          </span>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {showEmpty ? <EmptyState color="green" /> : feed.map(e => <CompareRow key={e.id} entry={e} simulated={false} />)}
        </div>
      </div>
    </div>
  );
}
