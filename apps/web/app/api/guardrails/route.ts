import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveApiKey } from "@/lib/supabase/resolve-api-key";

/**
 * GET /api/guardrails
 *
 * Returns guardrails for a specific agent (and optionally a specific version).
 * No Bearer auth required (dashboard admin route).
 *
 * Query params:
 *   agent_id       string   required — agent UUID
 *   agent_version  number   optional — if omitted, returns all versions
 *
 * Response:
 *   { guardrails: Guardrail[] }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const agentId      = searchParams.get("agent_id");
  const agentVersion = searchParams.get("agent_version");

  if (!agentId) {
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("guardrails")
    .select("*")
    .eq("agent_id", agentId)
    .order("agent_version", { ascending: false });

  if (agentVersion) {
    query = query.eq("agent_version", parseInt(agentVersion, 10));
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ guardrails: data ?? [] });
}

/**
 * PATCH /api/guardrails
 *
 * Merges a single tool name into deny_patterns for an agent.
 *
 * Security note: this endpoint is intentionally unauthenticated, consistent
 * with the other dashboard-admin GET routes (guardrails, agents, requests).
 * The entire dashboard has no session auth. The mutation is conservative
 * (adds to DENY, never removes rules), and agent_id is a non-enumerable UUID.
 * Before moving to production, replace with a server action or require a
 * session cookie so only the authenticated dashboard owner can mutate.
 *
 * Body:
 *   agent_id   string  required
 *   tool_name  string  required
 */
export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { agent_id, tool_name } = body as { agent_id?: string; tool_name?: string };
  if (!agent_id || !tool_name) {
    return NextResponse.json({ error: "agent_id and tool_name are required" }, { status: 400 });
  }

  const [{ data: agent }, { data: existing }] = await Promise.all([
    supabaseAdmin.from("agents").select("id, version").eq("id", agent_id).maybeSingle(),
    supabaseAdmin.from("guardrails").select("*").eq("agent_id", agent_id)
      .order("agent_version", { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const deny_patterns = [...new Set([...(existing?.deny_patterns ?? []), tool_name])];

  const { data, error } = await supabaseAdmin
    .from("guardrails")
    .upsert(
      {
        agent_id,
        agent_version: existing?.agent_version ?? agent.version,
        deny_patterns,
        allow_patterns: existing?.allow_patterns ?? [],
        max_calls_per_min: existing?.max_calls_per_min ?? null,
      },
      { onConflict: "agent_id,agent_version" },
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ guardrail: data });
}

/**
 * POST /api/guardrails
 *
 * Upserts guardrails for a specific agent version.
 * On conflict (agent_id, agent_version) the existing row is replaced.
 *
 * Body:
 *   agent_id          string   (uuid)       required
 *   agent_version     number                optional, defaults to agent's current version
 *   deny_patterns     string[]              optional, default []
 *   allow_patterns    string[]              optional, default []
 *   max_calls_per_min number | null         optional
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

  const { agent_id, agent_version, deny_patterns, allow_patterns, max_calls_per_min } = body as {
    agent_id?: string;
    agent_version?: number;
    deny_patterns?: string[];
    allow_patterns?: string[];
    max_calls_per_min?: number | null;
  };

  if (!agent_id) {
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
  }

  // Verify the agent belongs to this user
  const { data: agent, error: agentErr } = await supabaseAdmin
    .from("agents")
    .select("id, version")
    .eq("id", agent_id)
    .eq("user_id", caller.userId)
    .single();

  if (agentErr || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const version = agent_version ?? agent.version;

  const { data, error } = await supabaseAdmin
    .from("guardrails")
    .upsert(
      {
        agent_id,
        agent_version: version,
        deny_patterns: deny_patterns ?? [],
        allow_patterns: allow_patterns ?? [],
        max_calls_per_min: max_calls_per_min ?? null,
      },
      { onConflict: "agent_id,agent_version" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ guardrail: data }, { status: 200 });
}
