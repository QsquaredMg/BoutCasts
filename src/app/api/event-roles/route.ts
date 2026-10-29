import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_RE, KIND_LABEL, type EventKind } from "@/lib/eventRoles";

// Owners and admins manage who can moderate, or take over, a live vote or school election.
// The database decides who is allowed (see docs/sql/event_roles.sql); this route only adds the email.

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function parseKind(v: unknown): EventKind | null {
  return v === "live_vote" || v === "school_election" ? v : null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const kind = parseKind(url.searchParams.get("kind"));
  const eventId = url.searchParams.get("eventId") ?? "";
  if (!kind || !eventId) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { data, error } = await supabase.rpc("list_event_roles", { p_kind: kind, p_event_id: eventId });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ roles: data ?? [] });
}

export async function POST(request: Request) {
  let body: { kind?: string; eventId?: string; email?: string; role?: string; keepAccess?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const kind = parseKind(body.kind);
  const email = (body.email ?? "").trim().toLowerCase();
  if (!kind || !body.eventId || (body.role !== "moderator" && body.role !== "owner")) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const { data, error } = await supabase.rpc("invite_event_role", {
    p_kind: kind,
    p_event_id: body.eventId,
    p_email: email,
    p_role: body.role,
    p_keep_access: body.role === "owner" && body.keepAccess === true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const inv = data as { id: string; token: string; email: string; role: string; title: string; user_exists: boolean };

  const origin = new URL(request.url).origin.replace("://boutcasts.com", "://www.boutcasts.com");
  const link = `${origin}/invite/${inv.token}`;

  // Email it when Resend is set up; otherwise hand the link back so the sender can pass it on.
  let emailed = false;
  const apiKey = process.env.RESEND_API_KEY;
  if (apiKey) {
    const inviter = auth.user.email ?? "A BoutCasts organizer";
    const what = body.role === "owner" ? `take over the ${KIND_LABEL[kind]}` : `help run the ${KIND_LABEL[kind]}`;
    const subject = body.role === "owner" ? `You've been asked to take over "${inv.title}"` : `You've been invited to help run "${inv.title}"`;
    const text =
      `${inviter} invited you to ${what} "${inv.title}" on BoutCasts.\n\n` +
      `Open this link and ${inv.user_exists ? "sign in" : "create your account"} with this email address (${inv.email}) to accept:\n${link}\n\n` +
      `The link works for 14 days. If you weren't expecting this, you can ignore it.`;
    const html =
      `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px">` +
      `<p>${escapeHtml(inviter)} invited you to ${escapeHtml(what)} <b>${escapeHtml(inv.title ?? "")}</b> on BoutCasts.</p>` +
      `<p><a href="${link}" style="display:inline-block;background:#1b4fe4;color:#fff;font-weight:bold;padding:12px 22px;border-radius:999px;text-decoration:none">Review the invitation</a></p>` +
      `<p>${inv.user_exists ? "Sign in" : "Create your account"} with <b>${escapeHtml(inv.email)}</b> to accept. The link works for 14 days.</p>` +
      `<p style="color:#666;font-size:13px">If you weren't expecting this, you can ignore it.</p></div>`;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || "BoutCasts <info@boutcasts.com>",
        to: [inv.email],
        subject,
        text,
        html,
        ...(auth.user.email ? { reply_to: auth.user.email } : {}),
      }),
    }).catch(() => null);
    emailed = !!res && res.ok;
    if (res && !res.ok) console.error("event-role invite resend error", res.status, (await res.text().catch(() => "")).slice(0, 300));
  }

  return NextResponse.json({ ok: true, id: inv.id, emailed, link, userExists: inv.user_exists });
}
