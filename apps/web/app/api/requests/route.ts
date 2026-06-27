import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/requests
 *
 * Returns intercepted tool-call events, newest first.
 * Used by the dashboard — no Bearer auth required (admin-level server route).
 *
 * Query params:
 *   limit     number   max rows to return (default: 50, max: 200)
 *   offset    number   rows to skip for pagination (default: 0)
 *   agent_id  string   filter by agent UUID
 *   status    string   filter by ALLOWED | BLOCKED
 *   severity  string   filter by critical | high | medium | low
 *
 * Response:
 *   { requests: Request[], total: number }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const limit    = Math.min(parseInt(searchParams.get("limit")  ?? "50", 10), 200);
  const offset   = Math.max(parseInt(searchParams.get("offset") ?? "0",  10), 0);
  const agentId  = searchParams.get("agent_id");
  const status   = searchParams.get("status");
  const severity = searchParams.get("severity");

  let query = supabaseAdmin
    .from("requests")
    .select("id, agent_id, agent_version, tool_name, status, severity, payload, created_at", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (agentId)  query = query.eq("agent_id", agentId);
  if (status)   query = query.eq("status", status.toUpperCase());
  if (severity) query = query.eq("severity", severity.toLowerCase());

  const { data, count, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ requests: data ?? [], total: count ?? 0 });
}
