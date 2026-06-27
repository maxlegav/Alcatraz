import Anthropic from '@anthropic-ai/sdk';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { Request, Pattern, Insight } from '@/lib/supabase/types';

// ── Severity ranking ───────────────────────────────────────────────────────────
const SEV_RANK: Record<string, number> = {
  critical: 4, high: 3, medium: 2, low: 1,
};

// ── Types ─────────────────────────────────────────────────────────────────────
export type GroupedTool = {
  tool_name: string;
  blocked_count: number;
  worst_severity: string | null;
  example_payloads: Record<string, unknown>[];
};

// ── groupRequests ──────────────────────────────────────────────────────────────
// Pure function — safe to unit test without any DB or network calls.
export function groupRequests(requests: Request[]): GroupedTool[] {
  const map = new Map<string, GroupedTool>();

  for (const req of requests) {
    if (req.status !== 'BLOCKED') continue;

    const g = map.get(req.tool_name);
    if (!g) {
      map.set(req.tool_name, {
        tool_name: req.tool_name,
        blocked_count: 1,
        worst_severity: req.severity,
        example_payloads: req.payload ? [req.payload] : [],
      });
    } else {
      g.blocked_count++;
      const prev = SEV_RANK[g.worst_severity ?? ''] ?? 0;
      const next = SEV_RANK[req.severity ?? ''] ?? 0;
      if (next > prev) g.worst_severity = req.severity;
      if (g.example_payloads.length < 3 && req.payload) {
        g.example_payloads.push(req.payload);
      }
    }
  }

  return [...map.values()].sort((a, b) => {
    const byCount = b.blocked_count - a.blocked_count;
    if (byCount !== 0) return byCount;
    return (SEV_RANK[b.worst_severity ?? ''] ?? 0) - (SEV_RANK[a.worst_severity ?? ''] ?? 0);
  });
}

// ── runAnalysis ────────────────────────────────────────────────────────────────
// Calls Claude and returns an Insight (without persisting to DB).
export async function runAnalysis(
  agentId: string,
  agentVersion: number,
  groups: GroupedTool[],
  triggeredBy: 'manual' | 'scheduled',
): Promise<Omit<Insight, 'id' | 'created_at'>> {
  if (groups.length === 0) {
    return {
      agent_id: agentId,
      agent_version: agentVersion,
      patterns: [],
      summary: 'No blocked requests in this window.',
      triggered_by: triggeredBy,
    };
  }

  const anthropic = new Anthropic();

  const prompt = `You are an AI security analyst for an AI agent orchestration platform.

Below are patterns of blocked tool calls for a single AI agent. Identify ROOT CAUSE issues and suggest UPSTREAM FIXES — changes to the agent's system prompt, configuration, or environment that would eliminate the need for these blocks.

Do NOT suggest adding guardrail rules. Focus on what the agent developer should change upstream.

Blocked tool patterns (JSON):
${JSON.stringify(groups, null, 2)}

Respond with ONLY a valid JSON object matching this exact schema (no markdown fences):
{
  "patterns": [
    {
      "tool_name": "string",
      "blocked_count": number,
      "severity": "critical" | "high" | "medium" | "low" | null,
      "description": "what the agent is trying to do and why it keeps getting blocked",
      "suggestion": "specific actionable fix — e.g. inject DATABASE_URL into system prompt, redesign tool signature",
      "suggestion_type": "prompt_injection" | "tool_redesign" | "data_provision" | "other",
      "example_payloads": []
    }
  ],
  "summary": "1-2 sentence summary of the main issues and top recommendation"
}`;

  const msg = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = (msg.content.find(b => b.type === 'text') as { text: string } | undefined)?.text ?? '{}';

  // Strip markdown fences if the model included them despite instructions
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const parsed = JSON.parse(stripped) as { patterns: Pattern[]; summary: string };

  return {
    agent_id: agentId,
    agent_version: agentVersion,
    patterns: parsed.patterns ?? [],
    summary: parsed.summary ?? null,
    triggered_by: triggeredBy,
  };
}

// ── fetchAndAnalyze ────────────────────────────────────────────────────────────
// Determines analysis window, fetches requests, runs analysis, saves insight.
export async function fetchAndAnalyze(
  agentId: string,
  triggeredBy: 'manual' | 'scheduled',
): Promise<Insight> {
  const [{ data: agent }, { data: lastInsight }] = await Promise.all([
    supabaseAdmin.from('agents').select('version').eq('id', agentId).single(),
    supabaseAdmin
      .from('insights')
      .select('created_at')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const agentVersion = (agent as { version: number } | null)?.version ?? 1;

  // Fetch up to 1000 blocked requests; if a prior run exists, start from there
  let query = supabaseAdmin
    .from('requests')
    .select('*')
    .eq('agent_id', agentId)
    .eq('status', 'BLOCKED')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (lastInsight) {
    query = query.gt('created_at', lastInsight.created_at);
  }

  const { data: rows } = await query;
  const groups = groupRequests((rows ?? []) as Request[]);

  const partial = await runAnalysis(agentId, agentVersion, groups, triggeredBy);

  const { data: saved, error } = await supabaseAdmin
    .from('insights')
    .insert({
      agent_id: agentId,
      agent_version: agentVersion,
      patterns: partial.patterns,
      summary: partial.summary,
      triggered_by: triggeredBy,
    })
    .select('id, created_at')
    .single();

  if (error || !saved) throw new Error(error?.message ?? 'Failed to save insight');

  return { ...partial, id: (saved as { id: string; created_at: string }).id, created_at: (saved as { id: string; created_at: string }).created_at };
}
