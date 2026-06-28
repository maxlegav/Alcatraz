import React from 'react';
import Link from 'next/link';

export function Navbar() {
  return (
    <header className="flex items-center justify-between">
      <Link href="/" className="flex items-center gap-3">
        <img src="/logo.png" alt="" className="h-8 w-8 object-contain" aria-hidden="true" />
        <span className="text-[1.65rem] font-semibold tracking-[-0.05em] text-slate-800">
          Alcatraz
        </span>
      </Link>

      <nav className="hidden items-center gap-10 text-[0.975rem] text-slate-600 lg:flex">
        <a href="#how-it-works" className="hover:text-slate-900 transition-colors">
          How it works
        </a>
        <a href="#sdk" className="hover:text-slate-900 transition-colors">
          Integrate
        </a>
      </nav>

      <a
        href="/onboarding"
        className="inline-flex items-center rounded-full border border-slate-200 bg-white px-6 py-2.5 text-[0.925rem] font-medium text-[#635bff] shadow-[0_4px_14px_rgba(15,23,42,0.06)] hover:shadow-[0_6px_20px_rgba(15,23,42,0.09)] transition-shadow"
      >
        Go to dashboard
      </a>
    </header>
  );
}
