import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Accept an invitation from its emailed link. The database requires the signed-in
// account's verified email to match the invited address exactly.
export async function POST(request: Request) {
  let body: { token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const token = (body.token ?? "").trim();
  if (!/^[0-9a-f]{64}$/.test(token)) return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { data, error } = await supabase.rpc("accept_event_role", { p_token: token });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, result: data });
}
