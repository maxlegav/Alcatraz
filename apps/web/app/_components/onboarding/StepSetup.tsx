'use client';
import { useEffect, useState } from 'react';
import { CodeBlock } from './CodeBlock';
import { StepNavBar } from './StepNavBar';

function SetupStep({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</p>
      {children}
    </div>
  );
}

const TERMINAL_LINES = [
  { text: '$ alcatraz scan .',                                    color: 'text-emerald-400', delay: 400  },
  { text: '',                                                      color: 'text-slate-600',   delay: 700  },
  { text: 'Scanning demo/langchain/ ...',                         color: 'text-slate-400',   delay: 900  },
  { text: '  → research_agent.py       agent · 4 tools',         color: 'text-blue-400',    delay: 1200 },
  { text: '  → agent_vulnerable.py     agent · 6 tools',         color: 'text-blue-400',    delay: 1500 },
  { text: '  → devops_agent.py         agent · 5 tools',         color: 'text-blue-400',    delay: 1800 },
  { text: '  → finance_agent.py        agent · 3 tools',         color: 'text-blue-400',    delay: 2100 },
  { text: '  → support_agent.py        agent · 4 tools',         color: 'text-blue-400',    delay: 2400 },
  { text: '',                                                      color: 'text-slate-600',   delay: 2700 },
  { text: 'Mapping tool call graph...',                           color: 'text-slate-400',   delay: 2900 },
  { text: '  bash_executor  file_reader  http_request',          color: 'text-amber-400',   delay: 3200 },
  { text: '  env_reader     web_search   send_email',            color: 'text-amber-400',   delay: 3500 },
  { text: '',                                                      color: 'text-slate-600',   delay: 3800 },
  { text: '5 agent files · 6 tools · ready to scan',            color: 'text-emerald-400', delay: 4000 },
];

function ScanDiscoveryTerminal() {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const timers = TERMINAL_LINES.map((line, i) =>
      setTimeout(() => setVisibleCount(i + 1), line.delay),
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div className="rounded-xl border border-slate-800 bg-[#10172b] overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-800">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
        <span className="ml-2 text-[10px] font-mono text-slate-500">alcatraz scan .</span>
      </div>
      <div className="px-4 py-3 space-y-0.5 min-h-[180px]">
        {TERMINAL_LINES.slice(0, visibleCount).map((line, i) => (
          <p key={i} className={`text-xs font-mono leading-5 ${line.color} ${line.text === '' ? 'h-3' : ''}`}>
            {line.text}
            {i === visibleCount - 1 && visibleCount < TERMINAL_LINES.length && (
              <span className="inline-block w-1.5 h-3 bg-current ml-0.5 animate-pulse align-middle" />
            )}
          </p>
        ))}
      </div>
    </div>
  );
}

export function StepSetup({ onNext }: { onNext: () => void }) {
  useEffect(() => {
    fetch('/api/reset', { method: 'POST' }).catch(() => {});
    sessionStorage.removeItem('alc_epoch');
    sessionStorage.removeItem('alc_sessions');
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-800 mb-1">Environment Setup</h2>
        <p className="text-sm text-slate-500">Three steps to get Alcatraz running with your agent.</p>
      </div>

      <div className="space-y-4">
        <SetupStep title="1 — Install the SDK">
          <CodeBlock>{`pip install alcatraz-py`}</CodeBlock>
        </SetupStep>

        <SetupStep title="2 — Set environment variables">
          <CodeBlock>{`export ALCATRAZ_API_KEY="ak_dev_..."\nexport ALCATRAZ_AGENT_ID="<your-agent-uuid>"\nexport ALCATRAZ_API_URL="http://localhost:3000"`}</CodeBlock>
        </SetupStep>

        <SetupStep title="3 — Scan your project">
          <CodeBlock>{`alcatraz scan .`}</CodeBlock>
        </SetupStep>
      </div>

      <SetupStep title="Live discovery">
        <ScanDiscoveryTerminal />
      </SetupStep>

      <StepNavBar onNext={onNext} nextLabel="Next: Security Scan →" />
    </div>
  );
}
