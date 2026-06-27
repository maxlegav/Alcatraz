import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveApiKey } from "@/lib/supabase/resolve-api-key";

/**
 * POST /api/hitl
 * Called by the Python SDK when a REVIEW-listed tool needs operator approval.
 * Creates a pending HITL request and returns its id for polling.
 */
export async function POST(req: NextRequest) {
  const caller = await resolveApiKey(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { agent_id, tool_name, tool_input } = body as {
    agent_id?: string;
    tool_name?: string;
    tool_input?: string;
  };

  if (!agent_id || !tool_name) {
    return NextResponse.json({ error: "agent_id and tool_name required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("hitl_requests")
    .insert({ agent_id, tool_name, tool_input: tool_input ?? "" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, status: data.status });
}

/**
 * GET /api/hitl
 * - Without ?since=  → returns only pending requests (floating approval panel)
 * - With    ?since=  → returns ALL requests (pending + decided) after that timestamp
 *                      (used by the live feed to show historical HITL decisions)
 */
export async function GET(req: NextRequest) {
  const since = req.nextUrl.searchParams.get("since");

  let query = supabaseAdmin
    .from("hitl_requests")
    .select("*")
    .order("created_at", { ascending: true });

  if (since) {
    query = query.gt("created_at", since); // all statuses, scoped to session
  } else {
    query = query.eq("status", "pending"); // default: pending only
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ hitl_requests: data ?? [] });
}
