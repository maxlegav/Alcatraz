'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
type ScanVuln = {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
  cwe_id?: string;
  owasp_llm?: string;
};
type ScanRules = {
  DENY: string[];
  REVIEW?: string[];
  ALLOW: string[];
  MAX_CALLS_PER_MIN: number;
};
type ScanResult = { vulnerabilities: ScanVuln[]; rules: ScanRules; risk_score: number };

const STEPS = [
  { n: 1, label: 'Setup' },
  { n: 2, label: 'Scan' },
  { n: 3, label: 'Rules' },
];

const SEV_COLOR: Record<string, string> = {
  critical: 'text-red-400 bg-red-950 border-red-800',
  high:     'text-orange-400 bg-orange-950 border-orange-800',
  medium:   'text-amber-400 bg-amber-950 border-amber-800',
  low:      'text-slate-400 bg-slate-800 border-slate-700',
};
const SEV_DOT: Record<string, string> = {
  critical: 'bg-red-500', high: 'bg-orange-500', medium: 'bg-amber-500', low: 'bg-slate-500',
};

const SCAN_PHASES = [
  { label: 'Reading agent source code', detail: 'demo/langchain/research_agent.py' },
  { label: 'Mapping tool call graph', detail: 'Identifying reachable tools and call chains' },
  { label: 'Simulating adversarial inputs', detail: 'Prompt injection, data exfiltration patterns' },
  { label: 'Evaluating privilege escalation paths', detail: 'Lateral movement and over-permissioned tools' },
  { label: 'Scoring risk and generating rules', detail: 'Building DENY / REVIEW / ALLOW policy' },
];

// ── Step 1 ───────────────────────────────────────────────────────────────────
function StepSetup({ onNext }: { onNext: () => void }) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const verify = async () => {
    setStatus('checking');
    try {
      const res = await fetch('/api/agents');
      if (res.ok) { setStatus('ok'); }
      else { setErrorMsg('API returned ' + res.status); setStatus('error'); }
    } catch {
      setErrorMsg('Cannot reach Alcatraz server — is Next.js running?');
      setStatus('error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Environment Setup</h2>
        <p className="text-sm text-slate-400">Install the SDK and verify your connection to Alcatraz.</p>
      </div>

      <div className="space-y-3">
        <Label>1 — Install the Python SDK</Label>
        <CodeBlock>pip install alcatraz-py</CodeBlock>

        <Label>2 — Set environment variables</Label>
        <CodeBlock>{`export ALCATRAZ_API_KEY="ak_dev_..."
export ALCATRAZ_AGENT_ID="<your-agent-uuid>"
export ALCATRAZ_API_URL="http://localhost:3000"`}</CodeBlock>

        <Label>3 — Wrap your agent</Label>
        <CodeBlock>{`import alcatraz

alcatraz.init(
    api_key=os.getenv("ALCATRAZ_API_KEY"),
    rules={"DENY": ["bash_executor"], "ALLOW": ["web_search"]},
    agent_id=os.getenv("ALCATRAZ_AGENT_ID"),
)`}</CodeBlock>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          onClick={verify}
          disabled={status === 'checking' || status === 'ok'}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all',
            status === 'ok'
              ? 'bg-emerald-900 text-emerald-300 border border-emerald-700'
              : status === 'error'
              ? 'bg-red-900 text-red-300 border border-red-700'
              : 'bg-blue-600 hover:bg-blue-500 text-white',
          )}
        >
          {status === 'checking' && <Spinner />}
          {status === 'ok' ? '✓ Connected' : status === 'error' ? '✗ Failed' : 'Verify Connection'}
        </button>
        {status === 'error' && <p className="text-xs text-red-400">{errorMsg}</p>}
      </div>

      <NavBar onNext={onNext} nextDisabled={status !== 'ok'} nextLabel="Next: Security Scan →" />
    </div>
  );
}

// ── Step 2 ───────────────────────────────────────────────────────────────────
function StepScan({ onNext, onResult }: { onNext: () => void; onResult: (r: ScanResult) => void }) {
  const [status, setStatus] = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [phaseIdx, setPhaseIdx] = useState(0);
  const phaseTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const runScan = async () => {
    setStatus('scanning');
    setPhaseIdx(0);

    // Advance phases during the scan
    phaseTimer.current = setInterval(() => {
      setPhaseIdx(p => (p < SCAN_PHASES.length - 1 ? p + 1 : p));
    }, 1800);

    try {
      const res = await fetch('/api/redteam', { method: 'POST' });
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

  useEffect(() => { void runScan(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (phaseTimer.current) clearInterval(phaseTimer.current); }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Security Scan</h2>
        <p className="text-sm text-slate-400">
          Your agent is analyzed by our internal security model, which detects vulnerabilities and generates protection rules.
        </p>
      </div>

      {/* Phase tracker */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Analysis Pipeline</span>
          {status === 'scanning' && (
            <span className="flex items-center gap-1.5 text-xs text-blue-400">
              <Spinner /> Running…
            </span>
          )}
          {status === 'done' && <span className="text-xs text-emerald-400 font-semibold">✓ Complete</span>}
          {status === 'error' && <span className="text-xs text-red-400">✗ {errorMsg}</span>}
        </div>

        {SCAN_PHASES.map((phase, i) => {
          const done = status === 'done' || i < phaseIdx;
          const active = status === 'scanning' && i === phaseIdx;
          return (
            <div key={i} className={cn('flex items-start gap-3 rounded-xl px-3 py-2.5 transition-all', active ? 'bg-blue-950 border border-blue-800' : done ? 'opacity-60' : 'opacity-25')}>
              <div className={cn('mt-0.5 h-4 w-4 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold', done ? 'bg-emerald-800 text-emerald-300' : active ? 'bg-blue-700 text-white' : 'bg-slate-800 text-slate-500')}>
                {done ? '✓' : i + 1}
              </div>
              <div className="min-w-0">
                <p className={cn('text-sm font-semibold', active ? 'text-blue-200' : done ? 'text-slate-300' : 'text-slate-600')}>{phase.label}</p>
                <p className={cn('text-[11px] mt-0.5 font-mono truncate', active ? 'text-blue-400' : 'text-slate-600')}>{phase.detail}</p>
              </div>
              {active && (
                <div className="ml-auto shrink-0"><Spinner /></div>
              )}
            </div>
          );
        })}
      </div>

      {/* Results */}
      {result && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
          <div className="flex items-center gap-3 mb-4">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Risk Score</span>
            <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
              <div
                className={cn('h-full rounded-full', result.risk_score >= 70 ? 'bg-red-500' : result.risk_score >= 40 ? 'bg-orange-500' : 'bg-amber-500')}
                style={{ width: `${result.risk_score}%` }}
              />
            </div>
            <span className={cn('text-sm font-bold tabular-nums', result.risk_score >= 70 ? 'text-red-400' : result.risk_score >= 40 ? 'text-orange-400' : 'text-amber-400')}>
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
                    {v.cwe_id && <span className="text-[10px] opacity-60">{v.cwe_id}</span>}
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

      <NavBar onNext={onNext} nextDisabled={status !== 'done'} nextLabel="Next: Review Rules →" />
    </div>
  );
}

// ── Step 3 ───────────────────────────────────────────────────────────────────
function StepRules({ scan }: { scan: ScanResult | null }) {
  const router = useRouter();
  const rules = scan?.rules ?? { DENY: ['bash_executor', 'env_reader'], REVIEW: ['database_query', 'send_report'], ALLOW: ['web_search', 'read_internal_doc', 'write_report'], MAX_CALLS_PER_MIN: 10 };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Security Rules</h2>
        <p className="text-sm text-slate-400">Rules generated from the scan. These will be passed to <code className="font-mono text-blue-400">alcatraz.init()</code>. Copy them into your agent to activate protection.</p>
      </div>

      <div className="space-y-3">
        <RuleGroup label="DENY" color="red" items={rules.DENY} description="Blocked unconditionally" />
        {rules.REVIEW && rules.REVIEW.length > 0 && (
          <RuleGroup label="REVIEW" color="amber" items={rules.REVIEW} description="Requires human approval (HITL)" />
        )}
        <RuleGroup label="ALLOW" color="emerald" items={rules.ALLOW} description="Permitted automatically" />
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-400">Rate limit</span>
          <span className="text-sm font-bold text-white">{rules.MAX_CALLS_PER_MIN} calls / min</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Generated code</p>
        <pre className="text-xs text-emerald-300 font-mono leading-5 overflow-x-auto whitespace-pre-wrap">{`alcatraz.init(
  api_key=os.getenv("ALCATRAZ_API_KEY"),
  rules=${JSON.stringify(rules, null, 4)},
  agent_id=os.getenv("ALCATRAZ_AGENT_ID"),
)`}</pre>
      </div>

      <div className="pt-2 border-t border-slate-800 flex justify-end">
        <button
          onClick={() => router.push('/dashboard')}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all bg-blue-600 hover:bg-blue-500 text-white"
        >
          Go to Dashboard →
        </button>
      </div>
    </div>
  );
}

function RuleGroup({ label, color, items, description }: { label: string; color: string; items: string[]; description: string }) {
  const colors: Record<string, { border: string; bg: string; text: string; chip: string }> = {
    red:     { border: 'border-red-800',     bg: 'bg-red-950',     text: 'text-red-400',     chip: 'bg-red-900 text-red-300' },
    amber:   { border: 'border-amber-800',   bg: 'bg-amber-950',   text: 'text-amber-400',   chip: 'bg-amber-900 text-amber-300' },
    emerald: { border: 'border-emerald-800', bg: 'bg-emerald-950', text: 'text-emerald-400', chip: 'bg-emerald-900 text-emerald-300' },
  };
  const c = colors[color];
  return (
    <div className={cn('rounded-xl border px-4 py-3', c.border, c.bg)}>
      <div className="flex items-center justify-between mb-2">
        <span className={cn('text-xs font-bold uppercase tracking-wider', c.text)}>{label}</span>
        <span className="text-[10px] text-slate-500">{description}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span key={item} className={cn('rounded-lg px-2 py-0.5 text-xs font-mono font-semibold', c.chip)}>{item}</span>
        ))}
      </div>
    </div>
  );
}

// ── Shared UI ─────────────────────────────────────────────────────────────────
function NavBar({ onNext, nextDisabled = false, nextLabel = 'Next →' }: { onNext: () => void; nextDisabled?: boolean; nextLabel?: string }) {
  return (
    <div className="pt-2 border-t border-slate-800 flex justify-end">
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className={cn(
          'px-5 py-2.5 rounded-xl text-sm font-semibold transition-all',
          nextDisabled ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white',
        )}
      >
        {nextLabel}
      </button>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{children}</p>;
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 text-xs font-mono text-emerald-300 leading-5 overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [scan, setScan] = useState<ScanResult | null>(null);

  const next = () => setStep(s => Math.min(s + 1, 3) as typeof s);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">

        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-bold text-white tracking-tight">Alcatraz</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">AI Agent Security Layer</p>
          </div>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={cn('flex items-center gap-1.5', step >= s.n ? 'opacity-100' : 'opacity-30')}>
                <div className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all',
                  step > s.n ? 'bg-emerald-600 text-white' : step === s.n ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500',
                )}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span className={cn('text-xs font-medium hidden sm:block', step >= s.n ? 'text-slate-300' : 'text-slate-600')}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('flex-1 h-px', step > s.n ? 'bg-emerald-700' : 'bg-slate-800')} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur-sm shadow-2xl">
          {step === 1 && <StepSetup onNext={next} />}
          {step === 2 && <StepScan onNext={next} onResult={setScan} />}
          {step === 3 && <StepRules scan={scan} />}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Already configured?{' '}
          <a href="/dashboard" className="text-slate-400 hover:text-white transition-colors">
            Go to dashboard →
          </a>
        </p>
      </div>
    </div>
  );
}
