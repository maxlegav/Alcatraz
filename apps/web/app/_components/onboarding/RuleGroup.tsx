import { cn } from '@/lib/utils';

const COLORS = {
  red: {
    border: 'border-rose-200',
    bg: 'bg-rose-50',
    text: 'text-rose-600',
    chip: 'bg-rose-100 text-rose-700',
  },
  amber: {
    border: 'border-amber-200',
    bg: 'bg-amber-50',
    text: 'text-amber-600',
    chip: 'bg-amber-100 text-amber-700',
  },
  emerald: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-600',
    chip: 'bg-emerald-100 text-emerald-700',
  },
} as const;

export function RuleGroup({
  label,
  color,
  items,
  description,
}: {
  label: string;
  color: 'red' | 'amber' | 'emerald';
  items: string[];
  description: string;
}) {
  const c = COLORS[color];
  return (
    <div className={cn('rounded-xl border px-4 py-3', c.border, c.bg)}>
      <div className="flex items-center justify-between mb-2">
        <span className={cn('text-xs font-bold uppercase tracking-wider', c.text)}>{label}</span>
        <span className="text-[10px] text-slate-400">{description}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map(item => (
          <span key={item} className={cn('rounded-lg px-2 py-0.5 text-xs font-mono font-semibold', c.chip)}>
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
