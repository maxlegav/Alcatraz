import React from 'react';
import Link from 'next/link';

const HERO_PILLS = [
  'Intercept unsafe tool calls',
  'Realtime policy enforcement',
  'Minutes to integrate',
];

export default function HeroSection() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-8 sm:px-8 sm:pb-24 sm:pt-12">
      <div className="absolute inset-x-0 top-0 -z-10 h-[30rem] bg-[radial-gradient(circle_at_top_left,_rgba(78,222,163,0.22),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(255,185,95,0.18),_transparent_28%),linear-gradient(180deg,_rgba(24,24,27,0.92),_rgba(19,19,27,1))]" />
      <div className="mx-auto max-w-6xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--color-on-surface-variant)]">
          <span className="h-2 w-2 rounded-full bg-[var(--color-secondary)]" />
          AI Agent Security Layer
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
          <div className="max-w-3xl">
            <h1 className="max-w-2xl text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl">
              Secure AI agents before they touch your systems
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-[color:rgba(228,225,237,0.82)]">
              Drop Alcatraz into any Python agent and intercept, log, and block
              dangerous tool calls in real time without rebuilding your stack.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-[var(--color-secondary)] px-5 py-3 text-sm font-semibold text-[var(--color-on-secondary)] transition hover:brightness-110"
              >
                Open live dashboard
              </Link>
              <a
                href="#integration"
                className="inline-flex items-center justify-center rounded-full border border-white/12 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                See the install
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-3">
              {HERO_PILLS.map((pill) => (
                <span
                  key={pill}
                  className="rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs font-medium text-[var(--color-on-surface-variant)]"
                >
                  {pill}
                </span>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-[1.75rem] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between border-b border-white/8 pb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-outline)]">
                  Live Guardrail
                </p>
                <p className="mt-2 text-sm text-white">`bash_exec` request intercepted</p>
              </div>
              <span className="rounded-full bg-[color:rgba(147,0,10,0.32)] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-error)]">
                Blocked
              </span>
            </div>

            <div className="mt-5 space-y-4 text-sm text-[var(--color-on-surface-variant)]">
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4 font-mono text-[13px] leading-6 text-[var(--color-error)]">
                rm -rf /var/lib/customer-data
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-outline)]">
                    Rule
                  </p>
                  <p className="mt-2 text-white">Block destructive shell commands</p>
                </div>
                <div className="rounded-2xl border border-white/8 bg-white/4 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-outline)]">
                    Response
                  </p>
                  <p className="mt-2 text-white">Logged to dashboard in 180ms</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
