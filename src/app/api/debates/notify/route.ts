import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/push/send";

// Called by a debater's browser right after they post a video or get
// matched: pushes a "your turn" / "you're matched" alert to the other side.
// Only participants can trigger it, and it only ever notifies the opponent.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { matchId } = (await request.json().catch(() => ({}))) as { matchId?: string };
  if (!matchId) return NextResponse.json({ ok: false }, { status: 400 });

  const admin = createAdminClient();
  const { data: m } = await admin
    .from("debate_matches")
    .select("id, status, turn_side, current_round, for_user_id, against_user_id, debate_topics(statement)")
    .eq("id", matchId)
    .maybeSingle();
  if (!m || (user.id !== m.for_user_id && user.id !== m.against_user_id)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const opponent = user.id === m.for_user_id ? m.against_user_id : m.for_user_id;
  const statement = (m.debate_topics as unknown as { statement: string } | null)?.statement ?? "your debate";
  const url = `/debates/match/${m.id}`;

  let message: { title: string; body: string };
  if (m.status === "voting") {
    message = { title: "🗳️ Your debate is in voting", body: `"${statement}" is done — share it and get votes!` };
  } else if (m.status === "active") {
    const turnUser = m.turn_side === "for" ? m.for_user_id : m.against_user_id;
    if (turnUser !== opponent) return NextResponse.json({ ok: true, sent: 0 });
    message = {
      title: m.current_round === 1 && m.turn_side === "for" ? "🎤 Your debate has started" : "🎤 Your turn to respond",
      body: `Watch your opponent's latest video, then respond on "${statement}".`,
    };
  } else {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const sent = await sendPushToUsers(admin, opponent ? [opponent] : [], { ...message, url, tag: `debate-${m.id}` });
  return NextResponse.json({ ok: true, sent });
}
