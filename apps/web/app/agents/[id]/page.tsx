import Link from 'next/link';
import { notFound } from 'next/navigation';
import AnalyzeButton from './AnalyzeButton';
import { supabaseAdmin } from '@/lib/supabase/server';
import { buildInsightSummary, getRecurringToolNames } from '@/lib/insight-summary';
import { deriveHealth, formatTimeAgo } from '@/lib/agent-status';
import type { Agent, AgentWithStats, Insight, Pattern, Request, SuggestionType } from '@/lib/supabase/types';

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-slate-100 text-slate-600',
};

const SUGGESTION_LABEL: Record<SuggestionType, string> = {
  prompt_injection: 'Prompt fix',
  tool_redesign: 'Tool redesign',
  data_provision: 'Data provisioning',
  other: 'Manual review',
};

async function getAgent(agentId: string): Promise<Agent | null> {
  const { data } = await supabaseAdmin
    .from('agents')
    .select('*')
    .eq('id', agentId)
    .maybeSingle();

  return (data as Agent | null) ?? null;
}

async function getInsights(agentId: string): Promise<Insight[]> {
  const { data } = await supabaseAdmin
    .from('insights')
    .select('*')
    .eq('agent_id', agentId)
    .order('created_at', { ascending: false })
    .limit(10);

  return (data as Insight[] | null) ?? [];
}

async function getStats(agent: Agent): Promise<AgentWithStats> {
  const [{ count: totalCalls }, { count: blockedCalls }, { data: latestRequest }] = await Promise.all([
    supabaseAdmin.from('requests').select('id', { count: 'exact', head: true }).eq('agent_id', agent.id),
    supabaseAdmin.from('requests').select('id', { count: 'exact', head: true }).eq('agent_id', agent.id).eq('status', 'BLOCKED'),
    supabaseAdmin
      .from('requests')
      .select('created_at')
      .eq('agent_id', agent.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    ...agent,
    totalCalls: totalCalls ?? 0,
    blockedCalls: blockedCalls ?? 0,
    lastActive: (latestRequest as Pick<Request, 'created_at'> | null)?.created_at ?? null,
  };
}

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const agent = await getAgent(id);
  if (!agent) {
    notFound();
  }

  const [insights, stats] = await Promise.all([
    getInsights(id),
    getStats(agent),
  ]);

  const latest = insights[0] ?? null;
  const previous = insights[1] ?? null;
  const recurringToolNames = latest
    ? getRecurringToolNames(latest.patterns, previous?.patterns ?? [])
    : [];
  const summary = buildInsightSummary(latest, previous);
  const health = deriveHealth(stats);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-4">
          <div>
            <Link href="/dashboard" className="text-sm text-slate-400 hover:text-slate-600">
              ← Dashboard
            </Link>
            <h1 className="mt-1 text-xl font-semibold text-slate-900">{agent.name}</h1>
            <p className="mt-1 text-xs text-slate-400">
              v{agent.version} · {stats.totalCalls} requests · {stats.blockedCalls} blocked · {health.label}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Last activity {formatTimeAgo(stats.lastActive)}
            </p>
          </div>
          <AnalyzeButton agentId={agent.id} label="Re-analyze" />
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        {!latest ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-sm text-slate-500">
            No analysis yet. Run the first scan for this agent.
          </div>
        ) : (
          <>
            <section className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
                  Latest Analysis
                </h2>
                <span className="text-xs text-slate-400">
                  {new Date(latest.created_at).toLocaleString()} · {latest.triggered_by}
                </span>
                {summary && summary.recurring_tool_names.length > 0 && (
                  <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                    {summary.recurring_tool_names.length} recurring
                  </span>
                )}
              </div>

              {latest.summary && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-sm leading-6 text-slate-600">{latest.summary}</p>
                </div>
              )}

              <div className="space-y-3">
                {latest.patterns.map((pattern: Pattern) => {
                  const isRecurring = recurringToolNames.includes(pattern.tool_name);

                  return (
                    <div
                      key={pattern.tool_name}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="text-sm font-semibold text-slate-900">
                          {pattern.tool_name}
                        </code>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                          ×{pattern.blocked_count}
                        </span>
                        {pattern.severity && (
                          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${SEVERITY_BADGE[pattern.severity] ?? ''}`}>
                            {pattern.severity}
                          </span>
                        )}
                        {isRecurring && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                            Recurring
                          </span>
                        )}
                        <span className="ml-auto rounded bg-blue-50 px-1.5 py-0.5 text-xs font-medium text-blue-700">
                          {SUGGESTION_LABEL[pattern.suggestion_type]}
                        </span>
                      </div>

                      <p className="mt-3 text-sm leading-6 text-slate-600">
                        {pattern.description}
                      </p>

                      <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                          Suggested upstream fix
                        </p>
                        <p className="mt-1 text-sm leading-6 text-slate-700">
                          {pattern.suggestion}
                        </p>
                      </div>

                      {pattern.example_payloads.length > 0 && (
                        <details className="mt-3 text-xs">
                          <summary className="cursor-pointer select-none text-slate-400 hover:text-slate-600">
                            Example payloads ({pattern.example_payloads.length})
                          </summary>
                          <pre className="mt-2 overflow-auto rounded-xl bg-slate-100 p-3 text-slate-600">
                            {JSON.stringify(pattern.example_payloads, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {insights.length > 1 && (
              <section className="space-y-3">
                <h2 className="text-sm font-medium uppercase tracking-wider text-slate-500">
                  History
                </h2>
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  {insights.slice(1).map((insight) => (
                    <div
                      key={insight.id}
                      className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm text-slate-500 last:border-b-0"
                    >
                      <span>{new Date(insight.created_at).toLocaleString()}</span>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>{insight.patterns.length} patterns</span>
                        <span className="capitalize">{insight.triggered_by}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
