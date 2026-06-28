'use client';
import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';
import { StepNavBar } from './StepNavBar';

type ScanVuln = {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
  cwe_id?: string;
  owasp_llm?: string;
};
type ScanRules = { DENY: string[]; REVIEW?: string[]; ALLOW: string[]; MAX_CALLS_PER_MIN: number };
export type ScanResult = { vulnerabilities: ScanVuln[]; rules: ScanRules; risk_score: number };

const SCAN_PHASES = [
  { label: 'Reading agent source code',             detail: 'demo/langchain/research_agent.py' },
  { label: 'Mapping tool call graph',               detail: 'Identifying reachable tools and call chains' },
  { label: 'Simulating adversarial inputs',         detail: 'Prompt injection, data exfiltration patterns' },
  { label: 'Evaluating privilege escalation paths', detail: 'Lateral movement and over-permissioned tools' },
  { label: 'Scoring risk and generating rules',     detail: 'Building DENY / REVIEW / ALLOW policy' },
];

const SEV_COLOR: Record<string, string> = {
  critical: 'text-rose-700 bg-rose-50 border-rose-200',
  high:     'text-orange-700 bg-orange-50 border-orange-200',
  medium:   'text-amber-700 bg-amber-50 border-amber-200',
  low:      'text-slate-600 bg-slate-50 border-slate-200',
};
const SEV_DOT: Record<string, string> = {
  critical: 'bg-rose-500',
  high:     'bg-orange-500',
  medium:   'bg-amber-500',
  low:      'bg-slate-400',
};

export function StepScan({
  onNext,
  onResult,
}: {
  onNext: () => void;
  onResult: (r: ScanResult) => void;
}) {
  const [status, setStatus]     = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [result, setResult]     = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [phaseIdx, setPhaseIdx] = useState(0);
  const phaseTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const runScan = async () => {
    setStatus('scanning');
    setPhaseIdx(0);
    phaseTimer.current = setInterval(() => {
      setPhaseIdx(p => (p < SCAN_PHASES.length - 1 ? p + 1 : p));
    }, 1800);
    try {
      const res  = await fetch('/api/redteam', { method: 'POST' });
      const data = await res.json() as ScanResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Scan failed');
      setResult(data);
      onResult(data);
      setPhaseIdx(SCAN_PHASES.length - 1);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    } finally {
      if (phaseTimer.current) clearInterval(phaseTimer.current);
    }
  };

  useEffect(() => () => { if (phaseTimer.current) clearInterval(phaseTimer.current); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-800 mb-1">Red Team Scan</h2>
        <p className="text-sm text-slate-500">
          An internal red team agent attacks your agent source code to find exploitable vulnerabilities — then generates the protection rules automatically.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-sm">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Analysis Pipeline</span>
          {status === 'scanning' && (
            <span className="flex items-center gap-1.5 text-xs text-blue-600">
              <Spinner /> Running…
            </span>
          )}
          {status === 'done'  && <span className="text-xs text-emerald-600 font-semibold">✓ Complete</span>}
          {status === 'error' && <span className="text-xs text-rose-600">✗ {errorMsg}</span>}
        </div>
        {SCAN_PHASES.map((phase, i) => {
          const done   = status === 'done' || i < phaseIdx;
          const active = status === 'scanning' && i === phaseIdx;
          return (
            <div
              key={i}
              className={cn(
                'flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all',
                active
                  ? 'bg-blue-50 border border-blue-200'
                  : done
                    ? 'bg-slate-50 border border-slate-200'
                    : 'opacity-30',
              )}
            >
              <div
                className={cn(
                  'mt-0.5 h-4 w-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold',
                  done   ? 'bg-emerald-100 text-emerald-600' :
                  active ? 'bg-blue-600 text-white' :
                           'bg-slate-200 text-slate-400',
                )}
              >
                {done ? '✓' : i + 1}
              </div>
              <div className="min-w-0">
                <p className={cn('text-sm font-semibold', active ? 'text-blue-700' : done ? 'text-slate-700' : 'text-slate-400')}>
                  {phase.label}
                </p>
                <p className={cn('text-[11px] mt-0.5 font-mono truncate', active ? 'text-blue-500' : 'text-slate-400')}>
                  {phase.detail}
                </p>
              </div>
              {active && <div className="ml-auto shrink-0"><Spinner /></div>}
            </div>
          );
        })}
      </div>

      {result && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Risk Score</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full',
                  result.risk_score >= 70 ? 'bg-rose-500' :
                  result.risk_score >= 40 ? 'bg-orange-500' : 'bg-amber-500',
                )}
                style={{ width: `${result.risk_score}%` }}
              />
            </div>
            <span
              className={cn(
                'text-sm font-bold tabular-nums',
                result.risk_score >= 70 ? 'text-rose-600' :
                result.risk_score >= 40 ? 'text-orange-600' : 'text-amber-600',
              )}
            >
              {result.risk_score}/100
            </span>
          </div>
          <div className="space-y-2">
            {result.vulnerabilities.map((v, i) => (
              <div key={i} className={cn('flex items-start gap-3 rounded-xl border px-3 py-2.5', SEV_COLOR[v.severity])}>
                <span className={cn('mt-1 h-2 w-2 rounded-full shrink-0', SEV_DOT[v.severity])} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-bold uppercase tracking-wide">{v.severity}</span>
                    {v.cwe_id    && <span className="text-[10px] opacity-60">{v.cwe_id}</span>}
                    {v.owasp_llm && <span className="text-[10px] opacity-60">{v.owasp_llm}</span>}
                  </div>
                  <p className="text-sm font-semibold">{v.type}</p>
                  <p className="text-xs opacity-70 mt-0.5">{v.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(status === 'idle' || status === 'error') && (
        <button
          onClick={runScan}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold bg-[linear-gradient(135deg,#6965f4_0%,#5b7dff_100%)] text-white shadow-[0_4px_14px_rgba(99,91,255,0.3)] hover:shadow-[0_6px_20px_rgba(99,91,255,0.4)] transition-all"
        >
          {status === 'error' ? 'Retry Scan' : 'Run Red Team Scan'}
        </button>
      )}

      <StepNavBar onNext={onNext} nextDisabled={status !== 'done'} nextLabel="Next: Review Rules →" />
    </div>
  );
}
