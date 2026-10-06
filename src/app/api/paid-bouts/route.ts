import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActor } from "@/lib/paidBoutsServer";
import { PAID_BOUTS_ENABLED } from "@/lib/features";
import { PLATFORM_FEE_PCT, validateCreate, type CreateInput } from "@/lib/paidBouts";

// Create a paid bout. Organizers' bouts wait for an admin to approve them;
// bouts created by an admin open straight away.
export async function POST(req: NextRequest) {
  const { user, isAdmin } = await getActor();
  if (!user) return NextResponse.json({ error: "Sign in to create a paid bout." }, { status: 401 });
  if (!isAdmin && !PAID_BOUTS_ENABLED) {
    return NextResponse.json({ error: "Paid bouts aren't open to organizers yet. Contact us to run one." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || body.acceptTerms !== true) {
    return NextResponse.json({ error: "Please accept the organizer terms to continue." }, { status: 400 });
  }
  const input: CreateInput = {
    title: String(body.title ?? ""),
    description: body.description ? String(body.description).slice(0, 2000) : undefined,
    rules: String(body.rules ?? ""),
    judging: String(body.judging ?? ""),
    entryFeeCents: Number(body.entryFeeCents),
    minEntries: Number(body.minEntries),
    maxEntries: body.maxEntries ? Number(body.maxEntries) : null,
    entryDeadline: String(body.entryDeadline ?? ""),
    inviteOnly: body.inviteOnly === true,
    prizes: Array.isArray(body.prizes)
      ? body.prizes.map((p: { place: unknown; amountCents: unknown }) => ({ place: Number(p.place), amountCents: Number(p.amountCents) }))
      : [],
  };
  const problem = validateCreate(input);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  const admin = createAdminClient();
  const { data: bout, error } = await admin
    .from("paid_bouts")
    .insert({
      organizer_id: user.id,
      created_by_admin: isAdmin,
      title: input.title.trim(),
      description: input.description?.trim() || null,
      rules: input.rules.trim(),
      judging: input.judging.trim(),
      entry_fee_cents: input.entryFeeCents,
      platform_fee_pct: PLATFORM_FEE_PCT,
      min_entries: input.minEntries,
      max_entries: input.maxEntries,
      entry_deadline: new Date(input.entryDeadline).toISOString(),
      invite_only: input.inviteOnly,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !bout) return NextResponse.json({ error: error?.message ?? "Couldn't create the bout." }, { status: 500 });

  const { error: prizeError } = await admin
    .from("paid_bout_prizes")
    .insert(input.prizes.map((p) => ({ bout_id: bout.id, place: p.place, amount_cents: p.amountCents })));
  if (prizeError) {
    await admin.from("paid_bouts").delete().eq("id", bout.id);
    return NextResponse.json({ error: prizeError.message }, { status: 500 });
  }

  const { error: statusError } = await admin
    .from("paid_bouts")
    .update(
      isAdmin
        ? { status: "open", reviewed_by: user.id, reviewed_at: new Date().toISOString() }
        : { status: "pending_review" }
    )
    .eq("id", bout.id);
  if (statusError) {
    await admin.from("paid_bouts").delete().eq("id", bout.id);
    return NextResponse.json({ error: statusError.message }, { status: 400 });
  }

  return NextResponse.json({ id: bout.id, status: isAdmin ? "open" : "pending_review" });
}
