import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Short link for an event access code: boutcasts.com/j/ABC123 → its ballot.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("find_event_by_code", { p_code: code });
  const origin = new URL(request.url).origin;
  if (typeof data === "string" && data) return NextResponse.redirect(`${origin}/vote/${data}`);
  return NextResponse.redirect(`${origin}/join?code=${encodeURIComponent(code)}&notfound=1`);
}
