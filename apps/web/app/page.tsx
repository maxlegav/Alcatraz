'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

type ScanVuln = {
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string; description: string; cwe_id?: string; owasp_llm?: string;
};
type ScanRules = { DENY: string[]; REVIEW?: string[]; ALLOW: string[]; MAX_CALLS_PER_MIN: number };
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
  { label: 'Reading agent source code',            detail: 'demo/langchain/research_agent.py' },
  { label: 'Mapping tool call graph',              detail: 'Identifying reachable tools and call chains' },
  { label: 'Simulating adversarial inputs',        detail: 'Prompt injection, data exfiltration patterns' },
  { label: 'Evaluating privilege escalation paths',detail: 'Lateral movement and over-permissioned tools' },
  { label: 'Scoring risk and generating rules',    detail: 'Building DENY / REVIEW / ALLOW policy' },
];

// ── Step 1 ────────────────────────────────────────────────────────────────────
type CheckStatus = 'idle' | 'loading' | 'ok' | 'error';
type CheckStep = { label: string; detail: string; okDetail: string; status: CheckStatus };

function StepSetup({ onNext }: { onNext: () => void }) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [checks, setChecks] = useState<CheckStep[]>([
    { label: '1 — Install the Python SDK',     detail: 'pip install alcatraz-py',                       okDetail: 'alcatraz-py 0.4.2 detected',                status: 'idle' },
    { label: '2 — Set environment variables',  detail: 'ALCATRAZ_API_KEY · ALCATRAZ_AGENT_ID · API_URL', okDetail: 'All environment variables found',           status: 'idle' },
    { label: '3 — Wrap your agent',            detail: 'Verifying API endpoint connectivity…',           okDetail: 'Connected — alcatraz.init() ready',         status: 'idle' },
  ]);

  const setCheck = (i: number, patch: Partial<CheckStep>) =>
    setChecks(prev => prev.map((c, idx) => idx === i ? { ...c, ...patch } : c));

  // Reset DB + browser session state at the start of every onboarding
  useEffect(() => {
    fetch('/api/reset', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem('alc_epoch');
    sessionStorage.removeItem('alc_sessions');
  }, []);

  const verify = async () => {
    setPhase('running');

    // Step 1: SDK (simulated)
    setCheck(0, { status: 'loading' });
    await new Promise(r => setTimeout(r, 900));
    setCheck(0, { status: 'ok' });

    // Step 2: Env vars (simulated)
    setCheck(1, { status: 'loading' });
    await new Promise(r => setTimeout(r, 700));
    setCheck(1, { status: 'ok' });

    // Step 3: Real connection check
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
    if (s === 'ok')      return <span className="text-emerald-400 font-bold text-sm">✓</span>;
    if (s === 'error')   return <span className="text-red-400 font-bold text-sm">✗</span>;
    return <span className="h-4 w-4 inline-block" />;
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Environment Setup</h2>
        <p className="text-sm text-slate-400">Click <span className="text-white font-medium">Verify Setup</span> to validate each step automatically.</p>
      </div>

      {/* Code reference */}
      <div className="space-y-2">
        <CodeBlock>{`pip install alcatraz-py`}</CodeBlock>
        <CodeBlock>{`export ALCATRAZ_API_KEY="ak_dev_..."
export ALCATRAZ_AGENT_ID="<your-agent-uuid>"
export ALCATRAZ_API_URL="http://localhost:3000"`}</CodeBlock>
        <CodeBlock>{`import alcatraz
alcatraz.init(api_key=os.getenv("ALCATRAZ_API_KEY"),
              agent_id=os.getenv("ALCATRAZ_AGENT_ID"))`}</CodeBlock>
      </div>

      {/* Animated checks */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-2">
        {checks.map((c, i) => (
          <div
            key={i}
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-300',
              c.status === 'ok'      ? 'bg-emerald-950 border border-emerald-800' :
              c.status === 'loading' ? 'bg-blue-950 border border-blue-800' :
              c.status === 'error'   ? 'bg-red-950 border border-red-800' :
              'bg-slate-800/50 border border-slate-700 opacity-50',
            )}
          >
            <div className="w-5 flex justify-center shrink-0">{statusIcon(c.status)}</div>
            <div className="min-w-0 flex-1">
              <p className={cn('text-sm font-semibold', c.status === 'ok' ? 'text-emerald-300' : c.status === 'error' ? 'text-red-300' : c.status === 'loading' ? 'text-blue-200' : 'text-slate-400')}>
                {c.label}
              </p>
              <p className="text-[11px] font-mono text-slate-500 mt-0.5">
                {c.status === 'ok' ? c.okDetail : c.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      {phase === 'idle' || phase === 'error' ? (
        <button
          onClick={verify}
          className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all', phase === 'error' ? 'bg-red-900 hover:bg-red-800 text-red-300 border border-red-700' : 'bg-blue-600 hover:bg-blue-500 text-white')}
        >
          {phase === 'error' ? 'Retry Verification' : 'Verify Setup'}
        </button>
      ) : null}

      <NavBar onNext={onNext} nextDisabled={phase !== 'done'} nextLabel="Next: Security Scan →" />
    </div>
  );
}

// ── Step 2 ────────────────────────────────────────────────────────────────────
function StepScan({ onNext, onResult }: { onNext: () => void; onResult: (r: ScanResult) => void }) {
  const [status, setStatus]   = useState<'idle' | 'scanning' | 'done' | 'error'>('idle');
  const [result, setResult]   = useState<ScanResult | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [phaseIdx, setPhaseIdx] = useState(0);
  const phaseTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const runScan = async () => {
    setStatus('scanning'); setPhaseIdx(0);
    phaseTimer.current = setInterval(() => {
      setPhaseIdx(p => p < SCAN_PHASES.length - 1 ? p + 1 : p);
    }, 1800);
    try {
      const res  = await fetch('/api/redteam', { method: 'POST' });
      const data = await res.json() as ScanResult & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? 'Scan failed');
      setResult(data); onResult(data);
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
        <h2 className="text-xl font-semibold text-white mb-1">Red Team Scan</h2>
        <p className="text-sm text-slate-400">
          An internal red team agent attacks your agent source code to find exploitable vulnerabilities — then generates the protection rules automatically.
        </p>
      </div>

      {/* Phase tracker */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900 p-4 space-y-2.5">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Analysis Pipeline</span>
          {status === 'scanning' && <span className="flex items-center gap-1.5 text-xs text-blue-400"><Spinner /> Running…</span>}
          {status === 'done'     && <span className="text-xs text-emerald-400 font-semibold">✓ Complete</span>}
          {status === 'error'    && <span className="text-xs text-red-400">✗ {errorMsg}</span>}
        </div>
        {SCAN_PHASES.map((phase, i) => {
          const done   = status === 'done' || i < phaseIdx;
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
              {active && <div className="ml-auto shrink-0"><Spinner /></div>}
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
              <div className={cn('h-full rounded-full', result.risk_score >= 70 ? 'bg-red-500' : result.risk_score >= 40 ? 'bg-orange-500' : 'bg-amber-500')} style={{ width: `${result.risk_score}%` }} />
            </div>
            <span className={cn('text-sm font-bold tabular-nums', result.risk_score >= 70 ? 'text-red-400' : result.risk_score >= 40 ? 'text-orange-400' : 'text-amber-400')}>{result.risk_score}/100</span>
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

// ── Step 3 ────────────────────────────────────────────────────────────────────
type ConfigOption = { label: string; desc: string; enabled: boolean; locked?: boolean; note?: string };

function ConfigToggle({ label, desc, enabled, locked, note }: ConfigOption) {
  const [on, setOn] = useState(enabled);
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-slate-800 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-200">{label}</p>
        <p className="text-[11px] text-slate-500 mt-0.5">{on ? desc : (note ?? desc)}</p>
      </div>
      <button
        onClick={() => !locked && setOn(o => !o)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          on ? 'bg-blue-600' : 'bg-slate-700',
          locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        )}
        aria-pressed={on}
      >
        <span className={cn('inline-block h-4 w-4 m-0.5 rounded-full bg-white shadow transition-transform duration-200', on ? 'translate-x-4' : 'translate-x-0')} />
      </button>
    </div>
  );
}

function StepRules({ scan }: { scan: ScanResult | null }) {
  const router = useRouter();
  const rules = scan?.rules ?? {
    DENY: ['bash_executor', 'env_reader'],
    REVIEW: ['database_query', 'send_report'],
    ALLOW: ['web_search', 'read_internal_doc', 'write_report'],
    MAX_CALLS_PER_MIN: 10,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white mb-1">Security Rules</h2>
        <p className="text-sm text-slate-400">Rules generated from the scan. Copy them into your agent to activate protection.</p>
      </div>

      {/* Scan summary banner */}
      {scan && (
        <div className="rounded-xl border border-blue-800 bg-blue-950/60 px-4 py-3 flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-blue-900 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-blue-300">Rules derived from your Red Team scan</p>
            <p className="text-[11px] text-blue-400 mt-0.5">
              {scan.vulnerabilities.length} vulnerabilities found · {scan.vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high').length} critical/high
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className={cn('text-xl font-bold tabular-nums', scan.risk_score >= 70 ? 'text-red-400' : scan.risk_score >= 40 ? 'text-orange-400' : 'text-amber-400')}>
              {scan.risk_score}<span className="text-xs font-normal text-slate-500">/100</span>
            </p>
            <p className="text-[10px] text-slate-500">Risk score</p>
          </div>
        </div>
      )}

      {/* Rules */}
      <div className="space-y-3">
        <RuleGroup label="DENY"   color="red"     items={rules.DENY}                       description="Blocked unconditionally" />
        {rules.REVIEW && rules.REVIEW.length > 0 && (
          <RuleGroup label="REVIEW" color="amber"   items={rules.REVIEW}                     description="Requires human approval (HITL)" />
        )}
        <RuleGroup label="ALLOW"  color="emerald"  items={rules.ALLOW}                      description="Permitted automatically" />
        <div className="rounded-xl border border-slate-700 bg-slate-800/50 px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-400">Rate limit</span>
          <span className="text-sm font-bold text-white">{rules.MAX_CALLS_PER_MIN} calls / min</span>
        </div>
      </div>

      {/* Generated code */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Generated code</p>
        <pre className="text-xs text-emerald-300 font-mono leading-5 overflow-x-auto whitespace-pre-wrap">{`alcatraz.init(
  api_key=os.getenv("ALCATRAZ_API_KEY"),
  rules=${JSON.stringify(rules, null, 4)},
  agent_id=os.getenv("ALCATRAZ_AGENT_ID"),
)`}</pre>
      </div>

      {/* Demo configuration */}
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1">Demo Configuration</p>
        <p className="text-[11px] text-slate-600 mb-3">Adjust for your environment — HITL and prompt injection are always on for this demo.</p>
        <div className="space-y-0">
          <ConfigToggle label="Human-in-the-loop (HITL)" desc="Sensitive actions require manual approval" enabled locked />
          <ConfigToggle label="Authentication"           desc="API key validation on every request"       enabled={false} note="Bypassed for demo" />
          <ConfigToggle label="Prompt injection detection" desc="Auto-block detected injections"         enabled locked />
          <ConfigToggle label="Rate limiting"            desc={`Max ${rules.MAX_CALLS_PER_MIN} calls/min per agent`} enabled />
        </div>
      </div>

      <div className="pt-2 border-t border-slate-800 flex justify-end">
        <button
          onClick={() => router.push('/dashboard')}
          className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all"
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

function NavBar({ onNext, nextDisabled = false, nextLabel = 'Next →' }: { onNext: () => void; nextDisabled?: boolean; nextLabel?: string }) {
  return (
    <div className="pt-2 border-t border-slate-800 flex justify-end">
      <button onClick={onNext} disabled={nextDisabled} className={cn('px-5 py-2.5 rounded-xl text-sm font-semibold transition-all', nextDisabled ? 'bg-slate-800 text-slate-500 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white')}>
        {nextLabel}
      </button>
    </div>
  );
}
function Label({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">{children}</p>;
}
function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative group">
      <pre className="rounded-xl bg-slate-900 border border-slate-700 px-4 py-3 pr-10 text-xs font-mono text-emerald-300 leading-5 overflow-x-auto whitespace-pre-wrap">{children}</pre>
      <button
        onClick={copy}
        title="Copy"
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-slate-700 transition-all"
      >
        {copied
          ? <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          : <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
        }
      </button>
    </div>
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
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all', step > s.n ? 'bg-emerald-600 text-white' : step === s.n ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500')}>
                  {step > s.n ? '✓' : s.n}
                </div>
                <span className={cn('text-xs font-medium hidden sm:block', step >= s.n ? 'text-slate-300' : 'text-slate-600')}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={cn('flex-1 h-px', step > s.n ? 'bg-emerald-700' : 'bg-slate-800')} />}
            </div>
          ))}
        </div>

        <div className="rounded-3xl border border-slate-800 bg-slate-900/50 p-8 backdrop-blur-sm shadow-2xl">
          {step === 1 && <StepSetup onNext={next} />}
          {step === 2 && <StepScan onNext={next} onResult={setScan} />}
          {step === 3 && <StepRules scan={scan} />}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          Already configured?{' '}
          <a href="/dashboard" className="text-slate-400 hover:text-white transition-colors">Go to dashboard →</a>
        </p>
      </div>
    </div>
  );
}
