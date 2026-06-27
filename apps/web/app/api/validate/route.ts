import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Guardrail } from "@/lib/supabase/types";
import { resolveApiKey } from "@/lib/supabase/resolve-api-key";

/** Wildcard pattern match: "*" matches any substring. */
function matchesPattern(value: string, pattern: string): boolean {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(value);
}

function matchesAny(value: string, patterns: string[]): boolean {
  return patterns.some((p) => matchesPattern(value, p));
}

/**
 * POST /api/validate
 *
 * Validates a tool call against the agent's active guardrails and logs the
 * result to the `requests` table.
 *
 * Decision logic:
 *   1. If no guardrails are configured → ALLOWED
 *   2. If tool_name matches any deny_pattern → BLOCKED
 *   3. If allow_patterns are set and tool_name doesn't match any → BLOCKED
 *   4. If max_calls_per_min is set and the rate is exceeded → BLOCKED
 *   5. Otherwise → ALLOWED
 *
 * Body:
 *   agent_id      string   (uuid)              required
 *   agent_version number                        optional, defaults to agent's current version
 *   tool_name     string                        required
 *   payload       Record<string, unknown> | null  optional
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

  const { agent_id, agent_version, tool_name, payload } = body as {
    agent_id?: string;
    agent_version?: number;
    tool_name?: string;
    payload?: Record<string, unknown> | null;
  };

  if (!agent_id) {
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
  }
  if (!tool_name) {
    return NextResponse.json({ error: "tool_name is required" }, { status: 400 });
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

  // Load guardrails for this agent version
  const { data: guardrail } = await supabaseAdmin
    .from("guardrails")
    .select("*")
    .eq("agent_id", agent_id)
    .eq("agent_version", version)
    .single<Guardrail>();

  let status: "ALLOWED" | "BLOCKED" = "ALLOWED";
  let reason: string | undefined;

  if (guardrail) {
    // 1. Deny patterns
    if (guardrail.deny_patterns.length > 0 && matchesAny(tool_name, guardrail.deny_patterns)) {
      status = "BLOCKED";
      reason = `Tool "${tool_name}" matches a deny pattern`;
    }

    // 2. Allow-list: if configured and tool not in it → block
    if (
      status === "ALLOWED" &&
      guardrail.allow_patterns.length > 0 &&
      !matchesAny(tool_name, guardrail.allow_patterns)
    ) {
      status = "BLOCKED";
      reason = `Tool "${tool_name}" is not in the allow list`;
    }

    // 3. Rate limit
    if (status === "ALLOWED" && guardrail.max_calls_per_min != null) {
      const windowStart = new Date(Date.now() - 60_000).toISOString();
      const { count } = await supabaseAdmin
        .from("requests")
        .select("id", { count: "exact", head: true })
        .eq("agent_id", agent_id)
        .eq("agent_version", version)
        .gte("created_at", windowStart);

      if ((count ?? 0) >= guardrail.max_calls_per_min) {
        status = "BLOCKED";
        reason = `Rate limit exceeded (${guardrail.max_calls_per_min} calls/min)`;
      }
    }
  }

  // Log the request
  const { data: request, error: insertErr } = await supabaseAdmin
    .from("requests")
    .insert({
      agent_id,
      agent_version: version,
      tool_name,
      status,
      payload: payload ?? null,
    })
    .select()
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json(
    { status, reason: reason ?? null, request_id: request.id },
    { status: 200 }
  );
}
