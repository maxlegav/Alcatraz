import React, { Suspense } from 'react';
import DashboardClient from '../_components/DashboardClient';

function DashboardSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-slate-50">
      {/* Header */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[linear-gradient(135deg,#6965f4_0%,#5b7dff_100%)]" />
            <div className="h-5 w-24 rounded-md bg-slate-200 animate-pulse" />
          </div>
          <div className="w-px h-5 bg-slate-200" />
          <div className="h-8 w-36 rounded-xl bg-slate-100 animate-pulse" />
        </div>
        <div className="flex items-center gap-3">
          <div className="h-5 w-10 rounded-md bg-slate-100 animate-pulse" />
          <div className="w-px h-5 bg-slate-200" />
          <div className="h-8 w-16 rounded-xl bg-slate-100 animate-pulse" />
          <div className="h-8 w-24 rounded-xl bg-slate-100 animate-pulse" />
        </div>
      </header>

      <div className="flex-1 overflow-hidden min-h-0">
        <div className="h-full max-w-[1440px] mx-auto px-8 py-6 flex flex-col gap-5">

          {/* KPI row */}
          <div className="grid grid-cols-4 gap-5 shrink-0">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="h-1 w-10 rounded-full mb-5 bg-slate-200 animate-pulse" />
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="h-3 w-24 rounded bg-slate-200 animate-pulse" />
                    <div className="h-9 w-16 rounded bg-slate-200 animate-pulse" />
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 animate-pulse shrink-0" />
                </div>
                <div className="h-3 w-32 rounded bg-slate-100 animate-pulse mt-4" />
              </div>
            ))}
          </div>

          {/* Main body */}
          <div className="grid grid-cols-[1fr_300px] gap-5 flex-1 min-h-0">
            {/* Feed */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <div className="space-y-1.5">
                  <div className="h-4 w-20 rounded bg-slate-200 animate-pulse" />
                  <div className="h-3 w-28 rounded bg-slate-100 animate-pulse" />
                </div>
                <div className="h-5 w-16 rounded bg-slate-100 animate-pulse" />
              </div>
              <div className="shrink-0 grid grid-cols-[8px_1fr_80px_90px_56px] gap-0 items-center px-5 py-2 bg-slate-50 border-b border-slate-100">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-2 w-full rounded bg-slate-200 animate-pulse" />
                ))}
              </div>
              <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 animate-pulse" />
                <div className="h-4 w-32 rounded bg-slate-200 animate-pulse" />
                <div className="h-3 w-48 rounded bg-slate-100 animate-pulse" />
              </div>
            </div>

            {/* Right panel */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div className="px-4 pt-3 border-b border-slate-100 flex items-center gap-1 shrink-0">
                {['Guardrails', 'HITL'].map(t => (
                  <div key={t} className="h-8 w-20 rounded-t-lg bg-slate-100 animate-pulse" />
                ))}
              </div>
              <div className="flex-1 p-4 space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-2.5 w-12 rounded bg-slate-200 animate-pulse" />
                    <div className="flex flex-wrap gap-1.5">
                      {[...Array(i + 1)].map((_, j) => (
                        <div key={j} className="h-6 w-16 rounded-md bg-slate-100 animate-pulse" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardClient />
    </Suspense>
  );
}
