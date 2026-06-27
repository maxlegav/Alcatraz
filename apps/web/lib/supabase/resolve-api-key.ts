import { NextRequest } from "next/server";
import { supabaseAdmin } from "./server";

export async function resolveApiKey(
  req: NextRequest
): Promise<{ userId: string; keyId: string } | null> {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const key = auth.slice(7).trim();

  const { data } = await supabaseAdmin
    .from("api_keys")
    .select("id, user_id")
    .eq("key", key)
    .single();

  if (!data) return null;

  await supabaseAdmin
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { userId: data.user_id, keyId: data.id };
}
