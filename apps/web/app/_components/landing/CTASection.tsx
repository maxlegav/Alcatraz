import React from 'react';
import Link from 'next/link';

export function CTASection() {
  return (
    <section className="mx-auto max-w-7xl px-6 pb-20 pt-8 sm:px-8 lg:px-10">
      <div
        className="relative overflow-hidden rounded-[2rem] px-10 py-20 sm:px-16 sm:py-24"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(148,163,184,0.15) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(148,163,184,0.15) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          backgroundColor: '#f8fafc',
        }}
      >
        {/* fade edges */}
        <div className="pointer-events-none absolute inset-0 rounded-[2rem] [background:radial-gradient(ellipse_80%_60%_at_50%_50%,transparent_40%,#f8fafc_100%)]" />

        <div className="relative text-center">
          <h2 className="text-2xl font-semibold tracking-[-0.05em] text-slate-800 sm:text-3xl lg:text-4xl">
            Let agents move fast.{' '}
            <span className="bg-[linear-gradient(135deg,#8b5cf6_12%,#4f8ff7_88%)] bg-clip-text text-transparent">
              Keep production intact.
            </span>
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-[1rem] leading-[1.75] tracking-[-0.02em] text-[#5b6b98]">
            Start with the SDK, generate guardrails from real attacks, and
            keep every agent action inside policy.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a
              href="/onboarding"
              className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#6965f4_0%,#5b7dff_100%)] px-8 py-3.5 text-[1rem] font-semibold text-white shadow-[0_12px_30px_rgba(99,91,255,0.26)] transition-shadow hover:shadow-[0_16px_40px_rgba(99,91,255,0.34)]"
            >
              Get started
            </a>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-8 py-3.5 text-[1rem] font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              View dashboard
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
