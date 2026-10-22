import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { bareAddress, replySubject, senderFor } from "@/lib/inbox";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Admin-only actions on the inbox: mark a thread read, open/close it, send a reply, or write a new email.
// Mail can go out from support@ or info@ (chosen with `from`).
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const { data: prof } = await supabase.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  if (!prof?.is_admin) return NextResponse.json({ error: "Admins only" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { action?: string; threadId?: string; text?: string; from?: string; to?: string; subject?: string } | null;
  const threadId = body?.threadId;
  const db = createAdminClient();

  if (body?.action === "compose") {
    const to = (body.to ?? "").trim();
    const subject = (body.subject ?? "").trim().slice(0, 200);
    const text = (body.text ?? "").trim();
    if (!EMAIL_RE.test(to) || !subject || !text || text.length > 20000) return NextResponse.json({ error: "Add a valid To address, a subject and a message." }, { status: 400 });
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "Email sending is not configured." }, { status: 501 });
    const sender = senderFor(body.from);
    const send = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: sender.from, to: [to], reply_to: sender.address, subject, text, html: `<div style="white-space:pre-wrap;font-family:sans-serif">${esc(text)}</div>` }),
    });
    if (!send.ok) {
      console.error("inbox compose failed", send.status, (await send.text()).slice(0, 300));
      return NextResponse.json({ error: "The email could not be sent. Check the Resend settings." }, { status: 502 });
    }
    const sent = (await send.json().catch(() => ({}))) as { id?: string };
    const newThread = `compose-${sent.id ?? crypto.randomUUID()}`;
    const { error: logErr1 } = await db.from("inbox_messages").insert({
      thread_id: newThread, direction: "out", resend_id: sent.id ?? null, from_addr: sender.from, to_addrs: [to], subject, text_body: text,
      sent_by: u.user.id, read_at: new Date().toISOString(),
    });
    if (logErr1) console.error("inbox: sent email not saved to the thread", newThread, logErr1);
    await db.from("inbox_threads").upsert({ thread_id: newThread, status: "done", updated_at: new Date().toISOString() }, { onConflict: "thread_id" });
    return NextResponse.json({ ok: true, threadId: newThread });
  }

  if (!body?.action || !threadId || threadId.length > 998) return NextResponse.json({ error: "Bad request" }, { status: 400 });

  if (body.action === "read") {
    const { error } = await db.from("inbox_messages").update({ read_at: new Date().toISOString() }).eq("thread_id", threadId).eq("direction", "in").is("read_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (body.action === "done" || body.action === "open") {
    const { error } = await db.from("inbox_threads").upsert({ thread_id: threadId, status: body.action, updated_at: new Date().toISOString() }, { onConflict: "thread_id" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }
  if (body.action !== "reply") return NextResponse.json({ error: "Unknown action" }, { status: 400 });

  const text = (body.text ?? "").trim();
  if (!text || text.length > 20000) return NextResponse.json({ error: "Write a reply first." }, { status: 400 });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Email sending is not configured." }, { status: 501 });

  const { data: msgs } = await db.from("inbox_messages").select("direction, from_addr, subject, message_id").eq("thread_id", threadId).order("received_at");
  const inbound = (msgs ?? []).filter((m) => m.direction === "in");
  const last = inbound[inbound.length - 1];
  if (!last?.from_addr) return NextResponse.json({ error: "Nothing to reply to." }, { status: 404 });
  const to = bareAddress(last.from_addr);
  const ids = (msgs ?? []).map((m) => m.message_id).filter((x): x is string => !!x);
  const from = body.from ? senderFor(body.from).from : process.env.RESEND_SUPPORT_FROM || senderFor("support").from;
  const subject = replySubject(last.subject);

  const headers: Record<string, string> = {};
  if (last.message_id) {
    headers["In-Reply-To"] = last.message_id;
    headers["References"] = ids.join(" ");
  }
  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [to], subject, text, html: `<div style="white-space:pre-wrap;font-family:sans-serif">${esc(text)}</div>`, headers }),
  });
  if (!send.ok) {
    console.error("inbox reply failed", send.status, (await send.text()).slice(0, 300));
    return NextResponse.json({ error: "The email could not be sent. Check the Resend settings." }, { status: 502 });
  }
  const sent = (await send.json().catch(() => ({}))) as { id?: string };
  const { error: logErr2 } = await db.from("inbox_messages").insert({
    thread_id: threadId, direction: "out", resend_id: sent.id ?? null, from_addr: from, to_addrs: [to], subject, text_body: text,
    sent_by: u.user.id, read_at: new Date().toISOString(),
  });
  if (logErr2) console.error("inbox: sent reply not saved to the thread", threadId, logErr2);
  await db.from("inbox_threads").upsert({ thread_id: threadId, status: "done", updated_at: new Date().toISOString() }, { onConflict: "thread_id" });
  return NextResponse.json({ ok: true });
}
