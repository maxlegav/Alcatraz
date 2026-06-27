import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!apiKey) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: agent } = await supabaseAdmin
    .from("agents")
    .select("id")
    .eq("api_key", apiKey)
    .single();

  if (!agent) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tool_name, status, severity, payload } = await req.json();

  if (!tool_name || !status) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("logs").insert({
    agent_id: agent.id,
    tool_name,
    status,
    severity: severity ?? null,
    payload: payload ?? null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true }, { status: 201 });
}
