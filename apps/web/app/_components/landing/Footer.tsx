import React from 'react';

function BrandMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden="true">
      <defs>
        <linearGradient id="footer-brand-grad" x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#4f8ff7" />
        </linearGradient>
      </defs>
      <path
        d="M13 6h8l6 10-6 10h-8L7 16l6-10Zm1.7 5L11.9 16l2.8 5h4.6l2.8-5-2.8-5h-4.6Z"
        fill="url(#footer-brand-grad)"
      />
    </svg>
  );
}

const LINKS = ['Docs', 'SDK Reference'];

export function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-[#fcfcfd]">
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <BrandMark />
              <span className="text-[1.3rem] font-semibold tracking-[-0.05em] text-slate-800">
                Alcatraz
              </span>
            </div>
            <p className="mt-2 text-[0.9rem] text-slate-500">
              Reinventing Cybersecurity.
            </p>
          </div>

          <div className="flex items-center gap-6">
            {LINKS.map(item => (
              <a
                key={item}
                href="#"
                className="text-[0.9rem] text-slate-500 transition-colors hover:text-slate-800"
              >
                {item}
              </a>
            ))}
          </div>
        </div>

        <p className="mt-8 border-t border-slate-100 pt-6 text-[0.8rem] text-slate-400">
          © 2025 Alcatraz. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
