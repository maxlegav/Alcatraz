'use client';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { RuleGroup } from './RuleGroup';
import { ConfigToggle } from './ConfigToggle';
import type { ScanResult } from './StepScan';

export function StepRules({ scan }: { scan: ScanResult | null }) {
  const router = useRouter();
  const rules = scan?.rules ?? {
    DENY: ['bash_executor', 'env_reader'],
    REVIEW: ['database_query', 'send_report'],
    ALLOW: ['web_search', 'read_internal_doc', 'write_report'],
    MAX_CALLS_PER_MIN: 10,
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-slate-800 mb-1">Security Rules</h2>
        <p className="text-sm text-slate-500">
          Rules generated from the scan. Copy them into your agent to activate protection.
        </p>
      </div>

      {scan && (
        <div className="rounded-xl border border-[#635bff]/30 bg-[#635bff]/5 px-4 py-3 flex items-center gap-4">
          <div className="w-8 h-8 rounded-lg bg-[#635bff]/10 flex items-center justify-center shrink-0">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#635bff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-[#635bff]">Rules derived from your Red Team scan</p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {scan.vulnerabilities.length} vulnerabilities found ·{' '}
              {scan.vulnerabilities.filter(v => v.severity === 'critical' || v.severity === 'high').length} critical/high
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p
              className={cn(
                'text-xl font-bold tabular-nums',
                scan.risk_score >= 70 ? 'text-rose-600' :
                scan.risk_score >= 40 ? 'text-orange-600' : 'text-amber-600',
              )}
            >
              {scan.risk_score}
              <span className="text-xs font-normal text-slate-400">/100</span>
            </p>
            <p className="text-[10px] text-slate-400">Risk score</p>
          </div>
        </div>
      )}

      <div className="space-y-3">
        <RuleGroup label="DENY"   color="red"     items={rules.DENY}   description="Blocked unconditionally" />
        {rules.REVIEW && rules.REVIEW.length > 0 && (
          <RuleGroup label="REVIEW" color="amber" items={rules.REVIEW} description="Requires human approval (HITL)" />
        )}
        <RuleGroup label="ALLOW"  color="emerald" items={rules.ALLOW}  description="Permitted automatically" />
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 flex items-center justify-between">
          <span className="text-sm text-slate-500">Rate limit</span>
          <span className="text-sm font-bold text-slate-800">{rules.MAX_CALLS_PER_MIN} calls / min</span>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-[#10172b] overflow-hidden">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-800">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          <span className="ml-2 text-[10px] text-slate-500 font-mono">Generated code</span>
        </div>
        <pre className="px-4 py-3 text-xs text-emerald-300 font-mono leading-5 overflow-x-auto whitespace-pre-wrap">{`alcatraz.init(
  api_key=os.getenv("ALCATRAZ_API_KEY"),
  rules=${JSON.stringify(rules, null, 4)},
  agent_id=os.getenv("ALCATRAZ_AGENT_ID"),
)`}</pre>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Demo Configuration</p>
        <p className="text-[11px] text-slate-400 mb-3">
          Adjust for your environment — HITL and prompt injection are always on for this demo.
        </p>
        <div className="space-y-0">
          <ConfigToggle label="Human-in-the-loop (HITL)"  desc="Sensitive actions require manual approval"            enabled locked />
          <ConfigToggle label="Authentication"             desc="API key validation on every request"                  enabled={false} note="Bypassed for demo" />
          <ConfigToggle label="Prompt injection detection" desc="Auto-block detected injections"                      enabled locked />
          <ConfigToggle label="Rate limiting"              desc={`Max ${rules.MAX_CALLS_PER_MIN} calls/min per agent`} enabled />
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <button
          onClick={() => router.push('/dashboard')}
          className="px-6 py-2.5 rounded-full text-sm font-semibold bg-[linear-gradient(135deg,#6965f4_0%,#5b7dff_100%)] text-white shadow-[0_4px_14px_rgba(99,91,255,0.3)] hover:shadow-[0_6px_20px_rgba(99,91,255,0.4)] transition-all"
        >
          Go to Dashboard →
        </button>
      </div>
    </div>
  );
}
