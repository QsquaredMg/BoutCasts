import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Sends a judge invitation email from BoutCasts (via Resend).
// Only someone who can already see the judge's private link (the organizer or
// an admin, enforced by the database's row rules) can send it. The link in the
// email is always built here from the judge record, never taken from the browser.
// Without RESEND_API_KEY this answers 501 and the browser falls back to the
// organizer's own email app.

type Kind = "showcase" | "debate" | "live_vote";

const TABLE: Record<Kind, { judges: string; parentCol: string; parent: string; titleCol: string; path: string }> = {
  showcase: { judges: "showcase_judges", parentCol: "showcase_id", parent: "showcases", titleCol: "title", path: "/showcase/judge/" },
  debate: { judges: "debate_judges", parentCol: "topic_id", parent: "debate_topics", titleCol: "statement", path: "/debates/judge/" },
  live_vote: { judges: "live_vote_judges", parentCol: "event_id", parent: "live_vote_events", titleCol: "title", path: "/judge/" },
};

const DAILY_LIMIT = 100;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Email sending isn't set up yet.", fallback: true }, { status: 501 });

  let body: { kind?: Kind; judgeId?: string; to?: string; subject?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const kind = body.kind;
  const to = (body.to ?? "").trim();
  const subject = (body.subject ?? "").trim().slice(0, 200);
  let text = (body.text ?? "").trim().slice(0, 6000);
  if (!kind || !(kind in TABLE) || !body.judgeId || !EMAIL_RE.test(to) || !subject || !text) {
    return NextResponse.json({ error: "Add the judge's email, a subject and the letter." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to send invites." }, { status: 401 });

  const t = TABLE[kind];
  const { data: judge } = await supabase.from(t.judges).select(`id, name, token, ${t.parentCol}`).eq("id", body.judgeId).maybeSingle();
  if (!judge) return NextResponse.json({ error: "You can only invite judges for events you run." }, { status: 403 });
  const j = judge as unknown as Record<string, string>;

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("judge_invite_sends")
    .select("id", { count: "exact", head: true })
    .eq("user_id", auth.user.id)
    .gte("sent_at", since);
  if ((count ?? 0) >= DAILY_LIMIT) {
    return NextResponse.json({ error: `You've sent ${DAILY_LIMIT} invites today. Try again tomorrow or use your email app.` }, { status: 429 });
  }

  const origin = new URL(request.url).origin.replace("://boutcasts.com", "://www.boutcasts.com");
  const link = `${origin}${t.path}${j.token}`;
  // Make sure the real link is in the letter even if it was edited out.
  if (!text.includes(link)) text = text.replace(/https?:\/\/\S+\/judge\/\S+/g, link);
  if (!text.includes(link)) text += `\n\nYour private judging link:\n${link}`;

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px">${escapeHtml(text)
    .replace(new RegExp(escapeHtml(link).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), `<a href="${link}" style="color:#1b4fe4;font-weight:bold">${escapeHtml(link)}</a>`)
    .replace(/\n/g, "<br>")}</div>`;

  const from = process.env.RESEND_FROM || "BoutCasts <judges@boutcasts.com>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html,
      ...(auth.user.email ? { reply_to: auth.user.email } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("judge-invite resend error", res.status, detail.slice(0, 300));
    return NextResponse.json({ error: "The email couldn't be sent. Try again, or use your email app.", fallback: true }, { status: 502 });
  }

  await supabase.from("judge_invite_sends").insert({ judge_kind: kind, judge_id: j.id, to_email: to });
  return NextResponse.json({ ok: true });
}
