import React from 'react';
import Link from 'next/link';

const CODE_SAMPLE = `from crewai import Agent
import alcatraz

alcatraz.init(
    api_key="agent_live_xxx",
    agent_name="finance-agent",
)

agent = Agent(...)
agent.kickoff()`;

export default function PlugAndPlaySection() {
  return (
    <section id="integration" className="px-6 py-20 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-center">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">
            Plug in with a few lines
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Keep your framework. Add the security layer.
          </h2>
          <p className="mt-4 text-base leading-7 text-[var(--color-on-surface-variant)]">
            The integration story should feel boring: install the SDK, initialize
            once, and start getting blocked tool calls and realtime telemetry.
          </p>
          <p className="mt-4 text-sm font-medium text-white">
            Call `alcatraz.init()` once, then let the agent run normally.
          </p>

          <div className="mt-8 space-y-3 text-sm text-[var(--color-on-surface-variant)]">
            <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
              `pip install alcatraz`
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
              Policy-backed `ALLOW` and `DENY` lists per agent
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/4 px-4 py-3">
              Built-in path to scans, logs, and operator visibility
            </div>
          </div>

          <Link
            href="/dashboard"
            className="mt-8 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            Explore the dashboard
          </Link>
        </div>

        <div className="overflow-hidden rounded-[1.75rem] border border-white/8 bg-[#0d0d15] shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
          <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-outline)]">
                Python SDK
              </p>
              <p className="mt-1 text-sm text-white">Minimal integration</p>
            </div>
            <span className="rounded-full bg-[color:rgba(192,193,255,0.12)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">
              V1
            </span>
          </div>

          <pre className="overflow-x-auto p-5 text-sm leading-7 text-[var(--color-on-surface)]">
            <code>{CODE_SAMPLE}</code>
          </pre>
        </div>
      </div>
    </section>
  );
}
