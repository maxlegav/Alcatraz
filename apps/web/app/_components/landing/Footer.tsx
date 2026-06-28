import React from 'react';

const LINKS = ['Docs', 'SDK Reference'];

export function Footer() {
  return (
    <footer className="border-t border-slate-100 bg-[#fcfcfd]">
      <div className="mx-auto max-w-7xl px-6 py-10 sm:px-8 lg:px-10">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Alcatraz" className="h-8 w-8 object-contain" />
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
