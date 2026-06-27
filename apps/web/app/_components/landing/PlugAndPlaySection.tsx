import React from 'react';

export function PlugAndPlaySection() {
  return (
    <section
      id="sdk"
      className="mx-auto max-w-7xl px-6 py-16 sm:px-8 lg:px-10"
    >
        <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="overflow-hidden rounded-[1.5rem] border border-slate-800 bg-[#10172b] shadow-[0_20px_60px_rgba(15,23,42,0.35)]">
            <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3 text-[11px] text-slate-400">
              <span className="h-3 w-3 rounded-full bg-rose-400" />
              <span className="h-3 w-3 rounded-full bg-amber-400" />
              <span className="h-3 w-3 rounded-full bg-emerald-400" />
              <span className="ml-3 font-mono">main.py</span>
            </div>
            <pre className="overflow-x-auto px-5 py-6 font-mono text-sm leading-7 text-slate-100">
              <code>
                <span className="text-blue-300">from</span>{' '}
                <span className="text-white">alcatraz</span>{' '}
                <span className="text-blue-300">import</span>{' '}
                <span className="text-cyan-300">AgentShield</span>
                {'\n\n'}
                <span className="text-emerald-300">shield</span> ={' '}
                <span className="text-cyan-300">AgentShield</span>(
                <span className="text-amber-300">api_key</span>=
                <span className="text-rose-300">&quot;sk_live_...&quot;</span>)
                {'\n'}
                <span className="text-emerald-300">agent</span> ={' '}
                <span className="text-emerald-300">shield</span>.
                <span className="text-cyan-300">wrap</span>(
                <span className="text-emerald-300">agent</span>)
                {'\n'}
                <span className="text-emerald-300">agent</span>.
                <span className="text-cyan-300">run</span>(
                <span className="text-amber-300">&quot;Reconcile invoices&quot;</span>)
                {'\n\n'}
                <span className="text-slate-500"># read .env → blocked</span>
              </code>
            </pre>
          </div>

          <div className="max-w-xl">
            <h2 className="text-2xl font-semibold tracking-[-0.05em] text-slate-800 sm:text-3xl">
              Integrate in minutes,{' '}
              <span className="bg-[linear-gradient(135deg,#8b5cf6_12%,#4f8ff7_88%)] bg-clip-text text-transparent">
                protected forever.
              </span>
            </h2>
            <p className="mt-4 text-[1.1rem] leading-[1.75] tracking-[-0.02em] text-[#5b6b98]">
              One SDK, three lines of code. Every tool call your agent
              makes is evaluated, logged, and blocked if it crosses a line.
              No rewrites. No policy engine to maintain.
            </p>
            <p className="mt-4 text-[0.95rem] leading-[1.75] tracking-[-0.02em] text-[#5b6b98]">
              Ship to production with confidence on day one.
            </p>
          </div>
        </div>
    </section>
  );
}
