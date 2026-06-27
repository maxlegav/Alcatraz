import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * POST /api/reset
 *
 * Clears all requests and hitl_requests from the database.
 * Called at the start of each onboarding session for a clean demo slate.
 * No auth required (admin route, demo only).
 */
export async function POST() {
  const epoch = new Date(0).toISOString(); // 1970 — matches everything

  const [reqRes, hitlRes] = await Promise.all([
    supabaseAdmin.from("requests").delete().gte("created_at", epoch),
    supabaseAdmin.from("hitl_requests").delete().gte("created_at", epoch),
  ]);

  if (reqRes.error || hitlRes.error) {
    return NextResponse.json(
      { error: reqRes.error?.message ?? hitlRes.error?.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
