import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { getActor } from "@/lib/paidBoutsServer";
import { money } from "@/lib/paidBouts";

// Actions on one paid bout. Every action checks who is calling:
//   approve / reject / markPaid  -> admins only
//   close / cancel / winners / settle / invite -> the organizer or an admin
// Money only moves in the database functions and in refunds issued here.

type Admin = ReturnType<typeof createAdminClient>;
type Bout = {
  id: string;
  organizer_id: string;
  title: string;
  status: string;
  entry_fee_cents: number;
  min_entries: number;
  entry_deadline: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function refundAll(admin: Admin, boutId: string) {
  const stripe = getStripe();
  const { data: entries } = await admin
    .from("paid_bout_entries")
    .select("id, stripe_payment_intent")
    .eq("bout_id", boutId)
    .eq("status", "paid");
  let failed = 0;
  for (const e of entries ?? []) {
    try {
      if (e.stripe_payment_intent) {
        await stripe.refunds.create({ payment_intent: e.stripe_payment_intent }, { idempotencyKey: `paid-bout-refund-${e.id}` });
      }
      await admin.from("paid_bout_entries").update({ status: "refunded", refunded_at: new Date().toISOString() }).eq("id", e.id);
    } catch (err) {
      failed++;
      console.error("paid bout refund failed", e.id, err);
    }
  }
  return failed;
}

async function cancelBout(admin: Admin, bout: Bout, reason: string) {
  const failed = await refundAll(admin, bout.id);
  if (failed > 0) {
    return NextResponse.json(
      { error: `${failed} refund(s) didn't go through, so the bout stays as it is. Try again in a moment.` },
      { status: 502 }
    );
  }
  await admin.from("paid_bouts").update({ status: "cancelled", cancelled_reason: reason }).eq("id", bout.id);
  return NextResponse.json({ ok: true, status: "cancelled" });
}

async function sendInviteEmail(opts: { to: string; subject: string; text: string; replyTo?: string | null }) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px">${esc(opts.text)
    .replace(/(https?:\/\/\S+)/g, '<a href="$1" style="color:#1b4fe4;font-weight:bold">$1</a>')
    .replace(/\n/g, "<br>")}</div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.RESEND_FROM || "BoutCasts <judges@boutcasts.com>",
      to: [opts.to],
      subject: opts.subject,
      text: opts.text,
      html,
      ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
    }),
  });
  return res.ok;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user, isAdmin } = await getActor();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const action = String(body?.action ?? "");

  const admin = createAdminClient();
  const { data: bout } = await admin
    .from("paid_bouts")
    .select("id, organizer_id, title, status, entry_fee_cents, min_entries, entry_deadline")
    .eq("id", id)
    .maybeSingle();
  if (!bout) return NextResponse.json({ error: "Bout not found." }, { status: 404 });
  const isOrganizer = bout.organizer_id === user.id;
  const canManage = isOrganizer || isAdmin;

  switch (action) {
    case "approve": {
      if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
      if (bout.status !== "pending_review") return NextResponse.json({ error: "This bout isn't waiting for review." }, { status: 400 });
      const { error } = await admin
        .from("paid_bouts")
        .update({ status: "open", reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_note: body.note ? String(body.note).slice(0, 500) : null })
        .eq("id", id);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, status: "open" });
    }

    case "reject": {
      if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
      if (bout.status !== "pending_review") return NextResponse.json({ error: "This bout isn't waiting for review." }, { status: 400 });
      const note = String(body.note ?? "").trim().slice(0, 500);
      if (!note) return NextResponse.json({ error: "Add a short reason so the organizer knows what to change." }, { status: 400 });
      await admin
        .from("paid_bouts")
        .update({ status: "cancelled", reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_note: note, cancelled_reason: `Not approved: ${note}` })
        .eq("id", id);
      return NextResponse.json({ ok: true, status: "cancelled" });
    }

    case "close": {
      if (!canManage) return NextResponse.json({ error: "Only the organizer or an admin can do that." }, { status: 403 });
      if (bout.status !== "open") return NextResponse.json({ error: "Only an open bout can be closed." }, { status: 400 });
      if (!isAdmin && Date.now() < Date.parse(bout.entry_deadline)) {
        return NextResponse.json({ error: "Entries stay open until the deadline." }, { status: 400 });
      }
      const { count } = await admin
        .from("paid_bout_entries")
        .select("id", { count: "exact", head: true })
        .eq("bout_id", id)
        .eq("status", "paid");
      if ((count ?? 0) < bout.min_entries) {
        // Not enough entries: the published terms say everyone is refunded in full.
        return cancelBout(admin, bout, `Minimum of ${bout.min_entries} entries was not reached`);
      }
      await admin.from("paid_bouts").update({ status: "closed" }).eq("id", id);
      return NextResponse.json({ ok: true, status: "closed" });
    }

    case "cancel": {
      if (!canManage) return NextResponse.json({ error: "Only the organizer or an admin can do that." }, { status: 403 });
      if (!["draft", "pending_review", "open", "closed"].includes(bout.status)) {
        return NextResponse.json({ error: "Payouts have started, so this bout can't be cancelled." }, { status: 400 });
      }
      return cancelBout(admin, bout, String(body.reason ?? "").trim().slice(0, 300) || "Cancelled by the organizer");
    }

    case "winners": {
      if (!canManage) return NextResponse.json({ error: "Only the organizer or an admin can do that." }, { status: 403 });
      if (bout.status !== "closed") return NextResponse.json({ error: "Choose winners after entries close." }, { status: 400 });
      const picks = (body.winners ?? {}) as Record<string, string>;
      const { data: prizes } = await admin.from("paid_bout_prizes").select("id, place").eq("bout_id", id).order("place");
      const { data: paid } = await admin.from("paid_bout_entries").select("id").eq("bout_id", id).eq("status", "paid");
      const paidIds = new Set((paid ?? []).map((e) => e.id as string));
      const chosen = new Set<string>();
      for (const p of prizes ?? []) {
        const entryId = picks[String(p.place)];
        if (!entryId || !paidIds.has(entryId)) return NextResponse.json({ error: `Pick a paid entry for place ${p.place}.` }, { status: 400 });
        if (chosen.has(entryId)) return NextResponse.json({ error: "One entry can't win two prizes." }, { status: 400 });
        chosen.add(entryId);
      }
      for (const p of prizes ?? []) {
        await admin.from("paid_bout_prizes").update({ winner_entry_id: picks[String(p.place)] }).eq("id", p.id);
      }
      return NextResponse.json({ ok: true });
    }

    case "settle": {
      if (!canManage) return NextResponse.json({ error: "Only the organizer or an admin can do that." }, { status: 403 });
      // Runs as the caller so the database can check who they are.
      const { error } = await supabase.rpc("paid_bout_settle", { p_bout: id });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true, status: "settling" });
    }

    case "markPaid": {
      if (!isAdmin) return NextResponse.json({ error: "Admins only." }, { status: 403 });
      const { error } = await supabase.rpc("paid_bout_mark_paid", {
        p_payout: String(body.payoutId ?? ""),
        p_method: String(body.method ?? ""),
        p_note: body.note ? String(body.note).slice(0, 300) : null,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ ok: true });
    }

    case "invite": {
      if (!canManage) return NextResponse.json({ error: "Only the organizer or an admin can do that." }, { status: 403 });
      if (!["draft", "pending_review", "open"].includes(bout.status)) {
        return NextResponse.json({ error: "Invites can be sent while the bout is open for entries." }, { status: 400 });
      }
      const emails = Array.from(
        new Set(
          (Array.isArray(body.emails) ? body.emails : [])
            .map((e: unknown) => String(e).trim().toLowerCase())
            .filter((e: string) => EMAIL_RE.test(e))
        )
      ).slice(0, 50) as string[];
      if (emails.length === 0) return NextResponse.json({ error: "Add at least one valid email address." }, { status: 400 });

      const { data: prizeRows } = await admin.from("paid_bout_prizes").select("amount_cents").eq("bout_id", id);
      const prizeTotal = (prizeRows ?? []).reduce((s, p) => s + (p.amount_cents as number), 0);
      const origin = (req.headers.get("origin") ?? new URL(req.url).origin).replace("://boutcasts.com", "://www.boutcasts.com");
      const deadline = new Date(bout.entry_deadline).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });

      const results: { email: string; link: string; emailed: boolean }[] = [];
      for (const email of emails) {
        let { data: invite } = await admin.from("paid_bout_invites").select("id, token").eq("bout_id", id).eq("email", email).maybeSingle();
        if (!invite) {
          const ins = await admin.from("paid_bout_invites").insert({ bout_id: id, email, invited_by: user.id }).select("id, token").single();
          invite = ins.data;
        }
        if (!invite) continue;
        const link = `${origin}/paid-bouts/${id}?invite=${invite.token}`;
        const emailed = await sendInviteEmail({
          to: email,
          subject: `You're invited to compete: ${bout.title}`,
          text: `You've been invited to enter "${bout.title}" on BoutCasts.\n\nEntry fee: ${money(bout.entry_fee_cents)}\nPrizes: ${money(prizeTotal)} total\nEntries close: ${deadline}\n\nRead the full rules, how winners are chosen and exactly how the money is paid out before you enter:\n${link}`,
          replyTo: user.email,
        });
        results.push({ email, link, emailed });
      }
      return NextResponse.json({ ok: true, invites: results, emailConfigured: Boolean(process.env.RESEND_API_KEY) });
    }

    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
}
