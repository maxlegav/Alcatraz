import { cn } from '@/lib/utils';

export function StepNavBar({
  onNext,
  nextDisabled = false,
  nextLabel = 'Next →',
}: {
  onNext: () => void;
  nextDisabled?: boolean;
  nextLabel?: string;
}) {
  return (
    <div className="pt-4 border-t border-slate-100 flex justify-end">
      <button
        onClick={onNext}
        disabled={nextDisabled}
        className={cn(
          'px-6 py-2.5 rounded-full text-sm font-semibold transition-all',
          nextDisabled
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-[linear-gradient(135deg,#6965f4_0%,#5b7dff_100%)] text-white shadow-[0_4px_14px_rgba(99,91,255,0.3)] hover:shadow-[0_6px_20px_rgba(99,91,255,0.4)]',
        )}
      >
        {nextLabel}
      </button>
    </div>
  );
}
