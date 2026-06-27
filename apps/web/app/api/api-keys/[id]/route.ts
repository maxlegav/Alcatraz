import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { resolveApiKey } from "@/lib/supabase/resolve-api-key";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/api-keys/[id]
 *
 * Revokes (permanently deletes) an API key.
 * Requires Authorization: Bearer <api_key>.
 * A key cannot revoke itself.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;

  const caller = await resolveApiKey(req);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Prevent a key from revoking itself
  if (caller.keyId === id) {
    return NextResponse.json(
      { error: "A key cannot revoke itself" },
      { status: 400 },
    );
  }

  // Verify the key belongs to this user before deleting
  const { data: existing, error: findErr } = await supabaseAdmin
    .from("api_keys")
    .select("id")
    .eq("id", id)
    .eq("user_id", caller.userId)
    .single();

  if (findErr || !existing) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("api_keys")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
