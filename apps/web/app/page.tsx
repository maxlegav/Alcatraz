import React from 'react';
import Link from 'next/link';

export default function Page() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
          Alcatraz
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
          Landing page coming soon
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          This root route is a temporary placeholder while the marketing site is
          still being built.
        </p>
        <Link
          href="/dashboard"
          className="mt-8 inline-flex items-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700"
        >
          Open dashboard
        </Link>
      </div>
    </main>
  );
}
