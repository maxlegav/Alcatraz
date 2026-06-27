import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * GET /api/hitl/[id]
 * Polled by the Python SDK every 2s to check if the operator has decided.
 * Returns { id, status } — no auth required (id is a hard-to-guess UUID).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { data, error } = await supabaseAdmin
    .from("hitl_requests")
    .select("id, status")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ id: data.id, status: data.status });
}

/**
 * PATCH /api/hitl/[id]
 * Called by the dashboard when the operator clicks Approve or Deny.
 * Body: { status: "approved" | "denied" }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { status } = body as { status?: string };

  if (status !== "approved" && status !== "denied") {
    return NextResponse.json(
      { error: "status must be 'approved' or 'denied'" },
      { status: 400 }
    );
  }

  const { data, error } = await supabaseAdmin
    .from("hitl_requests")
    .update({ status, decided_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id, status: data.status });
}
