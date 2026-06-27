import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Vulnerability } from "@/lib/supabase/types";
import { resolveApiKey } from "@/lib/supabase/resolve-api-key";

/**
 * GET /api/findings
 *
 * Returns findings for a specific agent (and optionally a specific version).
 * No Bearer auth required (dashboard admin route).
 *
 * Query params:
 *   agent_id       string   required — agent UUID
 *   agent_version  number   optional — if omitted, returns all versions
 *
 * Response:
 *   { findings: Finding[] }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const agentId      = searchParams.get("agent_id");
  const agentVersion = searchParams.get("agent_version");

  if (!agentId) {
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
  }

  let query = supabaseAdmin
    .from("findings")
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

  return NextResponse.json({ findings: data ?? [] });
}

/**
 * POST /api/findings
 *
 * Upserts a pen-test summary (findings) for a specific agent version.
 * On conflict (agent_id, agent_version) the existing row is replaced.
 *
 * Body:
 *   agent_id        string         (uuid)  required
 *   agent_version   number                 optional, defaults to agent's current version
 *   summary         string | null          optional
 *   vulnerabilities Vulnerability[]        optional, default []
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

  const { agent_id, agent_version, summary, vulnerabilities } = body as {
    agent_id?: string;
    agent_version?: number;
    summary?: string | null;
    vulnerabilities?: Vulnerability[];
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
    .from("findings")
    .upsert(
      {
        agent_id,
        agent_version: version,
        summary: summary ?? null,
        vulnerabilities: vulnerabilities ?? [],
      },
      { onConflict: "agent_id,agent_version" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ finding: data }, { status: 200 });
}
