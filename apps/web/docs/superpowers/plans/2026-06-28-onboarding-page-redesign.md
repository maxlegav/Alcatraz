# Onboarding Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `app/page.tsx` into focused component files and restyle to match the landing page's light visual language (white background, slate typography, indigo primary, landing-page card styles).

**Architecture:** Extract each wizard step and shared primitive into `app/_components/onboarding/`. The orchestrator `page.tsx` shrinks to ~50 lines holding only step state and the progress header. All existing logic, API calls, and data flow are preserved exactly — only presentation changes.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS 4

## Global Constraints

- Light theme throughout: `bg-[#f8fafc]` page, `bg-white` cards, `text-slate-800` headings
- Primary color: `#635bff` / gradient `bg-[linear-gradient(135deg,#6965f4_0%,#5b7dff_100%)]`
- Buttons: `rounded-full`, indigo gradient for primary, `bg-slate-100 text-slate-400` when disabled
- Cards: `rounded-xl border border-slate-200 bg-white shadow-sm` (inner), `rounded-[2rem] border border-slate-200 shadow-[0_20px_60px_rgba(15,23,42,0.08)]` (main card)
- Code panels: `rounded-xl border border-slate-800 bg-[#10172b]` with terminal dot header
- Status colors: emerald (ok/allowed), rose (error/blocked), amber (warning/review), blue (loading/active)
- Typography: Plus Jakarta Sans (already in layout), `tracking-[-0.03em]` headings, `text-slate-500` body
- Zero logic changes — all fetch calls, timers, sessionStorage ops, and state shapes preserved verbatim
- Component directory: `app/_components/onboarding/`

---

### Task 1: Spinner

**Files:**
- Create: `app/_components/onboarding/Spinner.tsx`

**Interfaces:**
- Produces: `export function Spinner(): JSX.Element`

- [ ] **Step 1: Create Spinner.tsx**

```tsx
export function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
```

- [ ] **Step 2: Verify file exists**

Run: `ls apps/web/app/_components/onboarding/`
Expected: `Spinner.tsx` listed

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/_components/onboarding/Spinner.tsx
git commit -m "feat: extract Spinner component to onboarding/"
```

---

### Task 2: CodeBlock

**Files:**
- Create: `app/_components/onboarding/CodeBlock.tsx`

**Interfaces:**
- Consumes: nothing
- Produces: `export function CodeBlock({ children }: { children: string }): JSX.Element`

- [ ] **Step 1: Create CodeBlock.tsx**

```tsx
'use client';
import { useState } from 'react';

export function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative group rounded-xl border border-slate-800 bg-[#10172b] overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-800">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </div>
      <pre className="px-4 py-3 pr-10 text-xs font-mono text-emerald-300 leading-5 overflow-x-auto whitespace-pre-wrap">{children}</pre>
      <button
        onClick={copy}
        title="Copy"
        className="absolute top-10 right-2 p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-slate-700 transition-all"
      >
        {copied
          ? <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          : <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
        }
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/_components/onboarding/CodeBlock.tsx
git commit -m "feat: extract CodeBlock with landing-style dark panel"
```

---

### Task 3: StepNavBar

**Files:**
- Create: `app/_components/onboarding/StepNavBar.tsx`

**Interfaces:**
- Produces: `export function StepNavBar({ onNext, nextDisabled?, nextLabel? }: { onNext: () => void; nextDisabled?: boolean; nextLabel?: string }): JSX.Element`

- [ ] **Step 1: Create StepNavBar.tsx**

```tsx
import { cn } from '@/lib/utils';

export function StepNavBar({
  onNext,
  nextDisabled = false,
  nextLabel = 'Next →',
}: {
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="pt-4 border-t border-slate-100 flex justify-end">
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className={cn(
          'px-6 py-2.5 rounded-full text-sm font-semibold transition-all',
          nextDisabled
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-[linear-gradient(135deg,#6965f4_0%,#5b7dff_100%)] text-white shadow-[0_4px_14px_rgba(99,91,255,0.3)] hover:shadow-[0_6px_20px_rgba(99,91,255,0.4)]',
        )}
      >
        {nextLabel}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/_components/onboarding/StepNavBar.tsx
git commit -m "feat: add StepNavBar with indigo gradient button"
```

---

### Task 4: ConfigToggle

**Files:**
- Create: `app/_components/onboarding/ConfigToggle.tsx`

**Interfaces:**
- Produces: `export function ConfigToggle({ label, desc, enabled, locked?, note? }: { label: string; desc: string; enabled: boolean; locked?: boolean; note?: string }): JSX.Element`

- [ ] **Step 1: Create ConfigToggle.tsx**

```tsx
'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function ConfigToggle({
  label,
  desc,
  enabled,
  locked,
  note,
}: {
  label: string;
  desc: string;
  enabled: boolean;
  locked?: boolean;
  note?: string;
}) {
  const [on, setOn] = useState(enabled);
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{on ? desc : (note ?? desc)}</p>
      </div>
      <button
        onClick={() => !locked && setOn(o => !o)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          on ? 'bg-[#635bff]' : 'bg-slate-200',
          locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        )}
        aria-pressed={on}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 m-0.5 rounded-full bg-white shadow transition-transform duration-200',
            on ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/_components/onboarding/ConfigToggle.tsx
git commit -m "feat: extract ConfigToggle with light theme"
```

---

### Task 5: RuleGroup

**Files:**
- Create: `app/_components/onboarding/RuleGroup.tsx`

**Interfaces:**
- Produces: `export function RuleGroup({ label, color, items, description }: { label: string; color: 'red' | 'amber' | 'emerald'; items: string[]; description: string }): JSX.Element`

- [ ] **Step 1: Create RuleGroup.tsx**

```tsx
import { cn } from '@/lib/utils';

const COLORS = {
  red: {
    border: 'border-rose-200',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    chip: 'bg-rose-100 text-rose-700',
  },
  amber: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    chip: 'bg-amber-100 text-amber-700',
  },
  emerald: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    chip: 'bg-emerald-100 text-emerald-700',
  },
} as const;

export function RuleGroup({
  label,
  color,
  items,
  description,
}: {
  label: string;
  color: 'red' | 'amber' | 'emerald';
  items: string[];
  description: string;
}) {
  const c = COLORS[color];
  return (
    <div className={cn('rounded-xl border px-4 py-3', c.border, c.bg)}>
      <div className="flex items-center justify-between mb-2">
        <span className={cn('text-xs font-bold uppercase tracking-wider', c.text)}>{label}</span>
        <span className="text-[10px] text-slate-400">{description}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span key={item} className={cn('rounded-lg px-2 py-0.5 text-xs font-mono font-semibold', c.chip)}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/_components/onboarding/RuleGroup.tsx
git commit -m "feat: extract RuleGroup with light-mode chip colors"
```

---

### Task 6: StepSetup

**Files:**
- Create: `app/_components/onboarding/StepSetup.tsx`

**Interfaces:**
- Consumes: `Spinner` from `./Spinner`, `CodeBlock` from `./CodeBlock`, `StepNavBar` from `./StepNavBar`
- Produces: `export function StepSetup({ onNext }: { onNext: () => void }): JSX.Element`

- [ ] **Step 1: Create StepSetup.tsx**

```tsx
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
    if (s === 'ok') return <span className="text-emerald-500 font-bold text-sm">✓</span>;
    if (s === 'error') return <span className="text-rose-500 font-bold text-sm">✗</span>;
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/_components/onboarding/StepSetup.tsx
git commit -m "feat: extract StepSetup with light theme"
```

---

### Task 7: StepScan

**Files:**
- Create: `app/_components/onboarding/StepScan.tsx`

**Interfaces:**
- Consumes: `Spinner` from `./Spinner`, `StepNavBar` from `./StepNavBar`
- Produces:
  - `export type ScanResult = { vulnerabilities: ScanVuln[]; rules: ScanRules; risk_score: number }`
  - `export function StepScan({ onNext, onResult }: { onNext: () => void; onResult: (r: ScanResult) => void }): JSX.Element`

- [ ] **Step 1: Create StepScan.tsx**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/_components/onboarding/StepScan.tsx
git commit -m "feat: extract StepScan with light theme"
```

---

### Task 8: StepRules

**Files:**
- Create: `app/_components/onboarding/StepRules.tsx`

**Interfaces:**
- Consumes: `RuleGroup` from `./RuleGroup`, `ConfigToggle` from `./ConfigToggle`, `ScanResult` from `./StepScan`
- Produces: `export function StepRules({ scan }: { scan: ScanResult | null }): JSX.Element`

- [ ] **Step 1: Create StepRules.tsx**

```tsx
'use client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { RuleGroup } from './RuleGroup';
import { ConfigToggle } from './ConfigToggle';
import type { ScanResult } from './StepScan';

export function StepRules({ scan }: { scan: ScanResult | null }) {
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
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-800 mb-1">Security Rules</h2>
        <p className="text-sm text-slate-500">
          Rules generated from the scan. Copy them into your agent to activate protection.
        </p>
      </div>

      {scan && (
        <div className="rounded-xl border border-[#635bff]/30 bg-[#635bff]/5 px-4 py-3 flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-[#635bff]/10 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#635bff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#635bff]">Rules derived from your Red Team scan</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {scan.vulnerabilities.length} vulnerabilities found ·{' '}
              {scan.vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high').length} critical/high
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={cn(
                'text-xl font-bold tabular-nums',
                scan.risk_score >= 70 ? 'text-rose-600' :
                scan.risk_score >= 40 ? 'text-orange-600' : 'text-amber-600',
              )}
            >
              {scan.risk_score}
              <span className="text-xs font-normal text-slate-400">/100</span>
            </p>
            <p className="text-[10px] text-slate-400">Risk score</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <RuleGroup label="DENY"   color="red"     items={rules.DENY}   description="Blocked unconditionally" />
        {rules.REVIEW && rules.REVIEW.length > 0 && (
          <RuleGroup label="REVIEW" color="amber" items={rules.REVIEW} description="Requires human approval (HITL)" />
        )}
        <RuleGroup label="ALLOW"  color="emerald" items={rules.ALLOW}  description="Permitted automatically" />
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-500">Rate limit</span>
          <span className="text-sm font-bold text-slate-800">{rules.MAX_CALLS_PER_MIN} calls / min</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#10172b] overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-800">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="ml-2 text-[10px] text-slate-500 font-mono">Generated code</span>
        </div>
        <pre className="px-4 py-3 text-xs text-emerald-300 font-mono leading-5 overflow-x-auto whitespace-pre-wrap">{`alcatraz.init(
  api_key=os.getenv("ALCATRAZ_API_KEY"),
  rules=${JSON.stringify(rules, null, 4)},
  agent_id=os.getenv("ALCATRAZ_AGENT_ID"),
)`}</pre>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Demo Configuration</p>
        <p className="text-[11px] text-slate-400 mb-3">
          Adjust for your environment — HITL and prompt injection are always on for this demo.
        </p>
        <div className="space-y-0">
          <ConfigToggle label="Human-in-the-loop (HITL)"   desc="Sensitive actions require manual approval"           enabled locked />
          <ConfigToggle label="Authentication"              desc="API key validation on every request"                 enabled={false} note="Bypassed for demo" />
          <ConfigToggle label="Prompt injection detection"  desc="Auto-block detected injections"                     enabled locked />
          <ConfigToggle label="Rate limiting"               desc={`Max ${rules.MAX_CALLS_PER_MIN} calls/min per agent`} enabled />
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button
          onClick={() => router.push('/dashboard')}
          className="px-6 py-2.5 rounded-full text-sm font-semibold bg-[linear-gradient(135deg,#6965f4_0%,#5b7dff_100%)] text-white shadow-[0_4px_14px_rgba(99,91,255,0.3)] hover:shadow-[0_6px_20px_rgba(99,91,255,0.4)] transition-all"
        >
          Go to Dashboard →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/_components/onboarding/StepRules.tsx
git commit -m "feat: extract StepRules with light theme"
```

---

### Task 9: Update page.tsx (orchestrator)

**Files:**
- Modify: `app/page.tsx` (full replacement)

**Interfaces:**
- Consumes: `StepSetup` from `./_components/onboarding/StepSetup`, `StepScan` + `ScanResult` from `./_components/onboarding/StepScan`, `StepRules` from `./_components/onboarding/StepRules`

- [ ] **Step 1: Replace page.tsx with lean orchestrator**

Replace the full contents of `app/page.tsx` with:

```tsx
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { StepSetup } from '@/app/_components/onboarding/StepSetup';
import { StepScan, type ScanResult } from '@/app/_components/onboarding/StepScan';
import { StepRules } from '@/app/_components/onboarding/StepRules';

const STEPS = [
  { n: 1, label: 'Setup' },
  { n: 2, label: 'Scan' },
  { n: 3, label: 'Rules' },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const next = () => setStep(s => Math.min(s + 1, 3) as typeof s);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">

        {/* Brand header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[linear-gradient(135deg,#6965f4_0%,#5b7dff_100%)] shadow-[0_4px_14px_rgba(99,91,255,0.3)]">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <p className="text-[1.1rem] font-semibold tracking-[-0.05em] text-slate-800">Alcatraz</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">AI Agent Security Layer</p>
          </div>
        </div>

        {/* Progress stepper */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={cn('flex items-center gap-1.5', step >= s.n ? 'opacity-100' : 'opacity-30')}>
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all',
                    step > s.n  ? 'bg-emerald-500 text-white' :
                    step === s.n ? 'bg-[#635bff] text-white' :
                                   'bg-slate-200 text-slate-400',
                  )}
                >
                  {step > s.n ? '✓' : s.n}
                </div>
                <span className={cn('text-xs font-medium hidden sm:block', step >= s.n ? 'text-slate-600' : 'text-slate-400')}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('flex-1 h-px', step > s.n ? 'bg-emerald-300' : 'bg-slate-200')} />
              )}
            </div>
          ))}
        </div>

        {/* Step card */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          {step === 1 && <StepSetup onNext={next} />}
          {step === 2 && <StepScan onNext={next} onResult={setScan} />}
          {step === 3 && <StepRules scan={scan} />}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Already configured?{' '}
          <a href="/dashboard" className="text-slate-600 hover:text-slate-800 transition-colors">
            Go to dashboard →
          </a>
        </p>

      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run from `apps/web/`:
```bash
npx tsc --noEmit
```
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "refactor: split onboarding page into components, apply landing page light theme"
git push
```

---

### Task 10: Visual verification

- [ ] **Step 1: Start dev server**

```bash
cd apps/web && npm run dev
```

- [ ] **Step 2: Open http://localhost:3000 and verify**

Check each of the following:
- Page background is light (`#f8fafc`), not dark
- Brand header shows indigo gradient shield icon + "Alcatraz" in slate-800
- Progress stepper shows 3 steps; active step uses indigo (#635bff) circle
- Main card is white with rounded-[2rem] and soft shadow
- Code blocks have dark panel (`bg-[#10172b]`) with terminal dots
- "Verify Setup" button is indigo gradient, rounded-full
- Checks turn emerald on success, rose on error, blue when loading
- Step 2: "Run Red Team Scan" button is indigo gradient
- Step 3: DENY chips are rose, REVIEW chips are amber, ALLOW chips are emerald
- "Go to Dashboard →" button is indigo gradient
- "Already configured?" link at bottom uses slate colors

- [ ] **Step 3: Final commit if any visual tweaks were made**

```bash
git add -A
git commit -m "fix: visual tweaks after onboarding redesign review"
git push
```
