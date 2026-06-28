'use client';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function ConfigToggle({
  label,
  desc,
  enabled,
  locked,
  note,
}: {
  label: string;
  desc: string;
  enabled: boolean;
  locked?: boolean;
  note?: string;
}) {
  const [on, setOn] = useState(enabled);
  return (
    <div className="flex items-center justify-between gap-3 py-3 border-b border-slate-100 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-[11px] text-slate-400 mt-0.5">{on ? desc : (note ?? desc)}</p>
      </div>
      <button
        onClick={() => !locked && setOn(o => !o)}
        className={cn(
          'relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
          on ? 'bg-[#635bff]' : 'bg-slate-200',
          locked ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
        )}
        aria-pressed={on}
      >
        <span
          className={cn(
            'inline-block h-4 w-4 m-0.5 rounded-full bg-white shadow transition-transform duration-200',
            on ? 'translate-x-4' : 'translate-x-0',
          )}
        />
      </button>
    </div>
  );
}
