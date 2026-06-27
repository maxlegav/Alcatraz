import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveApiKey } from "@/lib/supabase/resolve-api-key";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/agents/[id]
 *
 * Returns a single agent with its latest guardrails and findings.
 * No Bearer auth required (dashboard admin route).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const [agentRes, guardrailRes, findingRes] = await Promise.all([
    supabaseAdmin
      .from("agents")
      .select("id, user_id, name, version, created_at")
      .eq("id", id)
      .single(),
    supabaseAdmin
      .from("guardrails")
      .select("*")
      .eq("agent_id", id)
      .order("agent_version", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from("findings")
      .select("*")
      .eq("agent_id", id)
      .order("agent_version", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (agentRes.error || !agentRes.data) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  return NextResponse.json({
    agent:     agentRes.data,
    guardrail: guardrailRes.data ?? null,
    finding:   findingRes.data  ?? null,
  });
}

/**
 * PATCH /api/agents/[id]
 *
 * Updates an agent's name or bumps its version.
 * Requires Authorization: Bearer <api_key>.
 *
 * Body (all optional):
 *   name         string   rename the agent
 *   bump_version boolean  increment version by 1
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const caller = await resolveApiKey(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership
  const { data: agent, error: ownerErr } = await supabaseAdmin
    .from("agents")
    .select("id, version")
    .eq("id", id)
    .eq("user_id", caller.userId)
    .single();

  if (ownerErr || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) {
    updates.name = body.name.trim();
  }
  if (body.bump_version === true) {
    updates.version = agent.version + 1;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("agents")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ agent: data });
}

/**
 * DELETE /api/agents/[id]
 *
 * Permanently deletes an agent and all its associated data.
 * Requires Authorization: Bearer <api_key>.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const caller = await resolveApiKey(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership
  const { data: agent, error: ownerErr } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("id", id)
    .eq("user_id", caller.userId)
    .single();

  if (ownerErr || !agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("agents")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
