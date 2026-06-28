'use client';
import { useState } from 'react';

export function CodeBlock({ children }: { children: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="relative group rounded-xl border border-slate-800 bg-[#10172b] overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-800">
        <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
      </div>
      <pre className="px-4 py-3 pr-10 text-xs font-mono text-emerald-300 leading-5 overflow-x-auto whitespace-pre-wrap">{children}</pre>
      <button
        onClick={copy}
        title="Copy"
        className="absolute top-10 right-2 p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-slate-700 transition-all"
      >
        {copied
          ? <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          : <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
        }
      </button>
    </div>
  );
}
