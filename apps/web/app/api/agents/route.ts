import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveApiKey } from "@/lib/supabase/resolve-api-key";
import { buildInsightSummary } from "@/lib/insight-summary";
import type { Insight } from "@/lib/supabase/types";

/**
 * GET /api/agents
 *
 * Returns all agents with aggregated request stats.
 * Used by the dashboard — no Bearer auth required (admin-level server route).
 *
 * Response:
 *   { agents: AgentWithStats[] }
 */
export async function GET() {
  const [agentsRes, statsRes, insightsRes] = await Promise.all([
    supabaseAdmin
      .from("agents")
      .select("id, user_id, name, version, created_at")
      .order("name"),
    supabaseAdmin
      .from("requests")
      .select("agent_id, status, created_at"),
    supabaseAdmin
      .from("insights")
      .select("id, agent_id, agent_version, patterns, summary, triggered_by, created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (agentsRes.error || statsRes.error || insightsRes.error) {
    return NextResponse.json({
      error:
        agentsRes.error?.message ??
        statsRes.error?.message ??
        insightsRes.error?.message ??
        "Failed to load agents",
    }, { status: 500 });
  }

  const agents = agentsRes.data ?? [];
  const stats  = statsRes.data  ?? [];
  const insights = (insightsRes.data ?? []) as Insight[];

  const latestInsightsByAgent = new Map<string, Insight[]>();

  for (const insight of insights) {
    const existing = latestInsightsByAgent.get(insight.agent_id) ?? [];
    if (existing.length < 2) {
      existing.push(insight);
      latestInsightsByAgent.set(insight.agent_id, existing);
    }
  }

  const withStats = agents.map(agent => {
    const reqs = stats.filter(r => r.agent_id === agent.id);
    const lastActive = reqs.reduce<string | null>(
      (max, r) => !max || r.created_at > max ? r.created_at : max,
      null,
    );
    const [latestInsight, previousInsight] = latestInsightsByAgent.get(agent.id) ?? [];

    return {
      ...agent,
      totalCalls:   reqs.length,
      blockedCalls: reqs.filter(r => r.status === "BLOCKED").length,
      lastActive,
      latestInsight: buildInsightSummary(latestInsight ?? null, previousInsight ?? null),
    };
  });

  return NextResponse.json({ agents: withStats });
}

/**
 * POST /api/agents
 *
 * Registers a new agent for the authenticated user.
 * Requires Authorization: Bearer <api_key>.
 *
 * Body:
 *   name     string   required
 *   version  number   optional, defaults to 1
 *
 * Response:
 *   { agent: Agent }
 */
export async function POST(req: NextRequest) {
  const caller = await resolveApiKey(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, version } = body as { name?: string; version?: number };

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("agents")
    .insert({
      name:    name.trim(),
      user_id: caller.userId,
      version: version ?? 1,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ agent: data }, { status: 201 });
}
