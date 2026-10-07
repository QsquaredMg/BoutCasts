import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActor } from "@/lib/paidBoutsServer";
import { money } from "@/lib/paidBouts";

// An entrant pays the entry fee to join a paid bout. The entry only counts as
// paid when the Stripe webhook confirms it (paid_bout_confirm_entry), which
// also enforces the entry cap, so nobody can pay into a full or closed bout
// without being refunded.
const PENDING_HOLD_MS = 35 * 60 * 1000;

export async function POST(req: NextRequest) {
  const { user } = await getActor();
  if (!user) return NextResponse.json({ error: "Sign in to enter." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const boutId = typeof body?.boutId === "string" ? body.boutId : "";
  if (!boutId) return NextResponse.json({ error: "Missing boutId" }, { status: 400 });
  if (body?.rulesAccepted !== true) {
    return NextResponse.json({ error: "Please confirm you've read the rules and payout terms." }, { status: 400 });
  }
  const entryTitle = body?.entryTitle ? String(body.entryTitle).trim().slice(0, 120) : null;
  let entryUrl: string | null = null;
  if (body?.entryUrl && String(body.entryUrl).trim()) {
    entryUrl = String(body.entryUrl).trim();
    if (!/^https?:\/\//i.test(entryUrl)) return NextResponse.json({ error: "The entry link must start with https://" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: bout } = await admin
    .from("paid_bouts")
    .select("id, organizer_id, title, status, entry_fee_cents, max_entries, entry_deadline, invite_only")
    .eq("id", boutId)
    .maybeSingle();
  if (!bout || bout.status !== "open") return NextResponse.json({ error: "This bout isn't open for entries." }, { status: 400 });
  if (Date.now() > Date.parse(bout.entry_deadline)) return NextResponse.json({ error: "Entries for this bout have closed." }, { status: 400 });
  if (bout.organizer_id === user.id) return NextResponse.json({ error: "Organizers can't enter their own bout." }, { status: 400 });

  let inviteId: string | null = null;
  const token = typeof body?.inviteToken === "string" ? body.inviteToken : "";
  if (token) {
    const { data: invite } = await admin
      .from("paid_bout_invites")
      .select("id, status, accepted_by")
      .eq("bout_id", boutId)
      .eq("token", token)
      .maybeSingle();
    if (invite && (invite.status !== "accepted" || invite.accepted_by === user.id)) inviteId = invite.id;
  }
  if (bout.invite_only && !inviteId) {
    return NextResponse.json({ error: "This bout is invite-only. Open the link from your invitation." }, { status: 403 });
  }

  const { data: existing } = await admin
    .from("paid_bout_entries")
    .select("id, status")
    .eq("bout_id", boutId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing?.status === "paid") return NextResponse.json({ error: "You're already entered in this bout." }, { status: 400 });

  if (bout.max_entries) {
    const since = new Date(Date.now() - PENDING_HOLD_MS).toISOString();
    const { count: paid } = await admin
      .from("paid_bout_entries")
      .select("id", { count: "exact", head: true })
      .eq("bout_id", boutId)
      .eq("status", "paid");
    const { count: holding } = await admin
      .from("paid_bout_entries")
      .select("id", { count: "exact", head: true })
      .eq("bout_id", boutId)
      .eq("status", "pending")
      .gte("created_at", since)
      .neq("user_id", user.id);
    if ((paid ?? 0) + (holding ?? 0) >= bout.max_entries) {
      return NextResponse.json({ error: "This bout is full." }, { status: 400 });
    }
  }

  let entryId = existing?.id as string | undefined;
  if (entryId) {
    await admin
      .from("paid_bout_entries")
      .update({ entry_title: entryTitle, entry_url: entryUrl, fee_cents: bout.entry_fee_cents, invite_id: inviteId, rules_accepted_at: new Date().toISOString(), created_at: new Date().toISOString() })
      .eq("id", entryId);
  } else {
    const { data: created, error } = await admin
      .from("paid_bout_entries")
      .insert({ bout_id: boutId, user_id: user.id, entry_title: entryTitle, entry_url: entryUrl, fee_cents: bout.entry_fee_cents, invite_id: inviteId })
      .select("id")
      .single();
    if (error || !created) return NextResponse.json({ error: error?.message ?? "Couldn't start your entry." }, { status: 500 });
    entryId = created.id;
  }

  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    // Card also covers Apple Pay and Link; Cash App Pay is one-time payments in USD.
    payment_method_types: ["card", "cashapp"],
    customer_email: user.email ?? undefined,
    expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Entry fee: ${bout.title}`,
            description: `Refunded in full if the bout doesn't reach its minimum entries. ${money(bout.entry_fee_cents)}.`,
          },
          unit_amount: bout.entry_fee_cents,
        },
        quantity: 1,
      },
    ],
    success_url: `${origin}/paid-bouts/${boutId}?checkout=success`,
    cancel_url: `${origin}/paid-bouts/${boutId}?checkout=cancelled`,
    metadata: { kind: "paid_bout_entry", entry_id: entryId as string, bout_id: boutId },
  });
  await admin.from("paid_bout_entries").update({ stripe_session_id: session.id }).eq("id", entryId);
  return NextResponse.json({ url: session.url });
}
