import React from 'react';
import { HeroAsset } from './HeroAsset';

function ArrowRight() {
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
      <path
        d="M3 8h9m-3.5-3.5L12 8l-3.5 3.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

export function HeroSection() {
  return (
    <section className="overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 pb-12 pt-6 sm:px-8 lg:px-10">
        <div className="grid gap-10 pt-14 lg:grid-cols-[1fr_1fr] lg:items-center lg:pt-16">
          <div className="max-w-[640px]">
            <h1 className="text-[3.2rem] font-semibold leading-[1.02] tracking-[-0.05em] text-slate-800 sm:text-[4rem] lg:text-[5rem]">
              <span className="block">Your agents,</span>
              <span className="block bg-[linear-gradient(135deg,#8b5cf6_12%,#4f8ff7_88%)] bg-clip-text text-transparent">
                Enterprise Ready.
              </span>
            </h1>

            <p className="mt-8 max-w-lg text-[1.1rem] leading-[1.75] tracking-[-0.02em] text-[#5b6b98] sm:text-[1.15rem]">
              Alcatraz pentests every release, generates guardrails, and
              stops dangerous tool calls before they touch real data.
            </p>

            <div className="mt-9 flex flex-col gap-4 sm:flex-row sm:items-center">
              <a
                href="/onboarding"
                className="inline-flex items-center justify-center rounded-full bg-[linear-gradient(135deg,#6965f4_0%,#5b7dff_100%)] px-8 py-3.5 text-[1rem] font-semibold text-white shadow-[0_12px_30px_rgba(99,91,255,0.26)] hover:shadow-[0_16px_40px_rgba(99,91,255,0.34)] transition-shadow"
              >
                Get started
              </a>
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 text-[1rem] font-medium tracking-[-0.02em] text-slate-700 hover:text-slate-900 transition-colors"
              >
                <span>Talk to an expert</span>
                <ArrowRight />
              </a>
            </div>

          </div>
          <HeroAsset />
        </div>
      </div>
    </section>
  );
}
