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

      <StepNavBar onNext={onNext} nextLabel="Next: Security Scan →" />
    </div>
  );
}
