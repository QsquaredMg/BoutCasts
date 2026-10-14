import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { angleIds, headerValue, verifyResendWebhook } from "@/lib/inbox";

export const runtime = "nodejs";

// Resend calls this when mail arrives at the support address (event "email.received"). The webhook only
// carries metadata, so we fetch the full message, then file it into the thread it belongs to.
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const apiKey = process.env.RESEND_API_KEY;
  if (!secret || !apiKey) return NextResponse.json({ error: "Inbox is not configured" }, { status: 501 });

  const raw = await req.text();
  const ok = verifyResendWebhook(raw, { id: req.headers.get("svix-id"), timestamp: req.headers.get("svix-timestamp"), signature: req.headers.get("svix-signature") }, secret);
  if (!ok) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  if (event.type !== "email.received" || !event.data?.email_id) return NextResponse.json({ ok: true, ignored: true });

  const emailId = event.data.email_id;
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) {
    console.error("inbox fetch failed", res.status);
    return NextResponse.json({ error: "Could not fetch the email" }, { status: 502 }); // Resend retries
  }
  const mail = (await res.json()) as {
    from?: string; to?: string[]; subject?: string; html?: string | null; text?: string | null; message_id?: string;
    headers?: Record<string, unknown>; attachments?: unknown[]; authentication?: unknown; created_at?: string;
  };

  const db = createAdminClient();
  const messageId = mail.message_id ?? headerValue(mail.headers, "message-id");
  const inReplyTo = angleIds(headerValue(mail.headers, "in-reply-to"))[0] ?? null;
  const refs = [...angleIds(headerValue(mail.headers, "references")), ...(inReplyTo ? [inReplyTo] : [])];

  // Join an existing conversation when this mail answers one of its messages.
  let threadId: string | null = null;
  if (refs.length) {
    const { data: hit } = await db.from("inbox_messages").select("thread_id").in("message_id", refs).limit(1).maybeSingle();
    threadId = hit?.thread_id ?? null;
  }
  threadId ??= messageId ?? emailId;

  const { error } = await db.from("inbox_messages").upsert(
    {
      thread_id: threadId,
      direction: "in",
      resend_id: emailId,
      message_id: messageId,
      in_reply_to: inReplyTo,
      from_addr: mail.from ?? null,
      to_addrs: mail.to ?? [],
      subject: mail.subject ?? null,
      text_body: mail.text ?? null,
      html_body: mail.html ?? null,
      attachments: (mail.attachments ?? []).map((a) => {
        const x = a as Record<string, unknown>;
        return { id: x.id, filename: x.filename, content_type: x.content_type, size: x.size };
      }),
      authentication: mail.authentication ?? null,
      received_at: mail.created_at ?? new Date().toISOString(),
    },
    { onConflict: "resend_id", ignoreDuplicates: true },
  );
  if (error) {
    console.error("inbox insert failed", error.message);
    return NextResponse.json({ error: "Could not save" }, { status: 500 });
  }
  await db.from("inbox_threads").upsert({ thread_id: threadId, status: "open", updated_at: new Date().toISOString() }, { onConflict: "thread_id" });
  return NextResponse.json({ ok: true });
}
