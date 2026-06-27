import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveApiKey } from "@/lib/supabase/resolve-api-key";

/**
 * GET /api/api-keys
 *
 * Returns all API keys for the authenticated user.
 * The key value is returned so the user can copy it (plaintext storage in v1).
 * Requires Authorization: Bearer <api_key>.
 *
 * Response:
 *   { apiKeys: ApiKey[] }
 */
export async function GET(req: NextRequest) {
  const caller = await resolveApiKey(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .select("id, name, key, created_at, last_used_at")
    .eq("user_id", caller.userId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ apiKeys: data ?? [] });
}

/**
 * POST /api/api-keys
 *
 * Creates a new API key for the authenticated user.
 * Requires Authorization: Bearer <api_key>.
 *
 * Body:
 *   name  string   human-readable label (e.g. "Production")
 *
 * Response:
 *   { apiKey: ApiKey }
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

  const { name } = body as { name?: string };
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  // Generate a human-readable key with a prefix
  const raw = crypto.randomUUID().replace(/-/g, "");
  const key = `ak_${raw.slice(0, 24)}`;

  const { data, error } = await supabaseAdmin
    .from("api_keys")
    .insert({ user_id: caller.userId, name: name.trim(), key })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ apiKey: data }, { status: 201 });
}
