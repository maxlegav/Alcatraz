import React from 'react';

const PROBLEMS = [
  {
    title: 'Blind tool execution',
    body: 'Agents call shell, HTTP, and database tools with no final checkpoint between the model and your infrastructure.',
  },
  {
    title: 'Postmortems instead of prevention',
    body: 'Most teams only notice risky behavior after a bad prompt, leaked secret, or destructive command has already landed.',
  },
  {
    title: 'Custom wrappers everywhere',
    body: 'Security logic gets duplicated across demos, internal agents, and production workers instead of living in one layer.',
  },
];

export default function ProblemSection() {
  return (
    <section id="problem" className="px-6 py-20 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-tertiary)]">
            See the problem
          </p>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
            Your agent framework is fast. Its failure mode is faster.
          </h2>
          <p className="mt-4 text-base leading-7 text-[var(--color-on-surface-variant)]">
            Alcatraz exists for the gap between “the model decided to do it” and
            “the system actually let it happen.”
          </p>
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {PROBLEMS.map((problem) => (
            <article
              key={problem.title}
              className="rounded-[1.5rem] border border-white/8 bg-[color:rgba(255,255,255,0.03)] p-6"
            >
              <div className="mb-4 h-10 w-10 rounded-2xl bg-[color:rgba(255,185,95,0.14)]" />
              <h3 className="text-lg font-semibold text-white">{problem.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--color-on-surface-variant)]">
                {problem.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
