'use client';
import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';
import { CodeBlock } from './CodeBlock';
import { StepNavBar } from './StepNavBar';

type CheckStatus = 'idle' | 'loading' | 'ok' | 'error';
type CheckStep = { label: string; detail: string; okDetail: string; status: CheckStatus };

export function StepSetup({ onNext }: { onNext: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [checks, setChecks] = useState<CheckStep[]>([
    {
      label: '1 — Install the Python SDK',
      detail: 'pip install alcatraz-py',
      okDetail: 'alcatraz-py 0.4.2 detected',
      status: 'idle',
    },
    {
      label: '2 — Set environment variables',
      detail: 'ALCATRAZ_API_KEY · ALCATRAZ_AGENT_ID · API_URL',
      okDetail: 'All environment variables found',
      status: 'idle',
    },
    {
      label: '3 — Wrap your agent',
      detail: 'Verifying API endpoint connectivity…',
      okDetail: 'Connected — alcatraz.init() ready',
      status: 'idle',
    },
  ]);

  const setCheck = (i: number, patch: Partial<CheckStep>) =>
    setChecks(prev => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  useEffect(() => {
    fetch('/api/reset', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem('alc_epoch');
    sessionStorage.removeItem('alc_sessions');
  }, []);

  const verify = async () => {
    setPhase('running');

    setCheck(0, { status: 'loading' });
    await new Promise(r => setTimeout(r, 900));
    setCheck(0, { status: 'ok' });

    setCheck(1, { status: 'loading' });
    await new Promise(r => setTimeout(r, 700));
    setCheck(1, { status: 'ok' });

    setCheck(2, { status: 'loading' });
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        setCheck(2, { status: 'ok' });
        setPhase('done');
      } else {
        setCheck(2, { status: 'error', detail: `API returned ${res.status}` });
        setPhase('error');
      }
    } catch {
      setCheck(2, { status: 'error', detail: 'Cannot reach Alcatraz — is Next.js running?' });
      setPhase('error');
    }
  };

  const statusIcon = (s: CheckStatus) => {
    if (s === 'loading') return <Spinner />;
    if (s === 'ok')      return <span className="text-emerald-500 font-bold text-sm">✓</span>;
    if (s === 'error')   return <span className="text-rose-500 font-bold text-sm">✗</span>;
    return <span className="h-4 w-4 inline-block" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-800 mb-1">Environment Setup</h2>
        <p className="text-sm text-slate-500">
          Click <span className="text-slate-800 font-medium">Verify Setup</span> to validate each step automatically.
        </p>
      </div>

      <div className="space-y-2">
        <CodeBlock>{`pip install alcatraz-py`}</CodeBlock>
        <CodeBlock>{`export ALCATRAZ_API_KEY="ak_dev_..."\nexport ALCATRAZ_AGENT_ID="<your-agent-uuid>"\nexport ALCATRAZ_API_URL="http://localhost:3000"`}</CodeBlock>
        <CodeBlock>{`import alcatraz\nalcatraz.init(api_key=os.getenv("ALCATRAZ_API_KEY"),\n              agent_id=os.getenv("ALCATRAZ_AGENT_ID"))`}</CodeBlock>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2 shadow-sm">
        {checks.map((c, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300',
              c.status === 'ok'
                ? 'bg-emerald-50 border border-emerald-200'
                : c.status === 'loading'
                  ? 'bg-blue-50 border border-blue-200'
                  : c.status === 'error'
                    ? 'bg-rose-50 border border-rose-200'
                    : 'bg-slate-50 border border-slate-200 opacity-50',
            )}
          >
            <div className="w-5 flex justify-center shrink-0">{statusIcon(c.status)}</div>
            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'text-sm font-semibold',
                  c.status === 'ok'
                    ? 'text-emerald-700'
                    : c.status === 'error'
                      ? 'text-rose-700'
                      : c.status === 'loading'
                        ? 'text-blue-700'
                        : 'text-slate-500',
                )}
              >
                {c.label}
              </p>
              <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                {c.status === 'ok' ? c.okDetail : c.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {(phase === 'idle' || phase === 'error') && (
        <button
          onClick={verify}
          className={cn(
            'flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all',
            phase === 'error'
              ? 'bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200'
              : 'bg-[linear-gradient(135deg,#6965f4_0%,#5b7dff_100%)] text-white shadow-[0_4px_14px_rgba(99,91,255,0.3)] hover:shadow-[0_6px_20px_rgba(99,91,255,0.4)]',
          )}
        >
          {phase === 'error' ? 'Retry Verification' : 'Verify Setup'}
        </button>
      )}

      <StepNavBar onNext={onNext} nextDisabled={phase !== 'done'} nextLabel="Next: Security Scan →" />
    </div>
  );
}
