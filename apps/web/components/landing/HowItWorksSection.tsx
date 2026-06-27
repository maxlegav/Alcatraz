import React from 'react';

const STEPS = [
  {
    step: '01',
    title: 'Patch the agent runtime',
    body: 'Initialize Alcatraz once and it wraps tool execution before the call leaves your agent.',
  },
  {
    step: '02',
    title: 'Evaluate each tool call',
    body: 'Rules decide whether the request is allowed, blocked, or escalated, using the actual payload and context.',
  },
  {
    step: '03',
    title: 'Watch the system live',
    body: 'Every event is streamed into the dashboard so you can inspect blocked commands, patterns, and agent health.',
  },
];

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="px-6 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/8 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-8 sm:p-10">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-secondary)]">
            How it works
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            One security layer between the model and the toolchain
          </h2>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {STEPS.map((item) => (
            <article
              key={item.step}
              className="rounded-[1.5rem] border border-white/8 bg-black/20 p-6"
            >
              <p className="text-sm font-semibold text-[var(--color-outline)]">{item.step}</p>
              <h3 className="mt-6 text-xl font-semibold text-white">{item.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--color-on-surface-variant)]">
                {item.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
