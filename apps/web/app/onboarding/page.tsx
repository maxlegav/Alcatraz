'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { StepSetup } from '@/app/_components/onboarding/StepSetup';
import { StepScan, type ScanResult } from '@/app/_components/onboarding/StepScan';
import { StepRules } from '@/app/_components/onboarding/StepRules';

const STEPS = [
  { n: 1, label: 'Setup' },
  { n: 2, label: 'Scan' },
  { n: 3, label: 'Rules' },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const next = () => setStep(s => Math.min(s + 1, 3) as typeof s);

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">

        {/* Brand header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[linear-gradient(135deg,#6965f4_0%,#5b7dff_100%)] shadow-[0_4px_14px_rgba(99,91,255,0.3)]">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <p className="text-[1.1rem] font-semibold tracking-[-0.05em] text-slate-800">Alcatraz</p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">AI Agent Security Layer</p>
          </div>
        </div>

        {/* Progress stepper */}
        <div className="flex items-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center gap-2 flex-1">
              <div className={cn('flex items-center gap-1.5', step >= s.n ? 'opacity-100' : 'opacity-30')}>
                <div
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all',
                    step > s.n   ? 'bg-emerald-500 text-white' :
                    step === s.n ? 'bg-[#635bff] text-white' :
                                   'bg-slate-200 text-slate-400',
                  )}
                >
                  {step > s.n ? '✓' : s.n}
                </div>
                <span className={cn('text-xs font-medium hidden sm:block', step >= s.n ? 'text-slate-600' : 'text-slate-400')}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('flex-1 h-px', step > s.n ? 'bg-emerald-300' : 'bg-slate-200')} />
              )}
            </div>
          ))}
        </div>

        {/* Step card */}
        <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
          {step === 1 && <StepSetup onNext={next} />}
          {step === 2 && <StepScan onNext={next} onResult={setScan} />}
          {step === 3 && <StepRules scan={scan} />}
        </div>

        <p className="text-center text-xs text-slate-400 mt-6">
          Already configured?{' '}
          <a href="/dashboard" className="text-slate-600 hover:text-slate-800 transition-colors">
            Go to dashboard →
          </a>
        </p>

      </div>
    </div>
  );
}
