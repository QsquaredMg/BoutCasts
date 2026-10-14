import { createHmac, timingSafeEqual } from "node:crypto";

export type InboxMessage = {
  id: string;
  thread_id: string;
  direction: "in" | "out";
  from_addr: string | null;
  to_addrs: string[];
  subject: string | null;
  text_body: string | null;
  html_body: string | null;
  attachments: { id?: string; filename?: string; content_type?: string; size?: number }[];
  authentication: { spf?: string; dkim?: string; dmarc?: string } | null;
  message_id: string | null;
  received_at: string;
  read_at: string | null;
};

/** Checks a Resend (Svix) webhook signature against the raw request body. */
export function verifyResendWebhook(raw: string, h: { id: string | null; timestamp: string | null; signature: string | null }, secret: string): boolean {
  if (!h.id || !h.timestamp || !h.signature || !secret) return false;
  const ts = Number(h.timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 5 * 60) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${h.id}.${h.timestamp}.${raw}`).digest();
  return h.signature.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const given = Buffer.from(sig, "base64");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}

/** "Name <a@b.com>" -> "a@b.com" */
export function bareAddress(from: string | null | undefined): string {
  const m = /<([^>]+)>/.exec(from ?? "");
  return (m ? m[1] : (from ?? "")).trim().toLowerCase();
}

export function displayName(from: string | null | undefined): string {
  const f = (from ?? "").trim();
  const m = /^"?([^"<]+?)"?\s*</.exec(f);
  return m ? m[1].trim() : bareAddress(f) || "Unknown sender";
}

export function headerValue(headers: Record<string, unknown> | null | undefined, name: string): string | null {
  if (!headers) return null;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  const v = key ? headers[key] : null;
  return typeof v === "string" ? v : null;
}

export function angleIds(s: string | null | undefined): string[] {
  return (s ?? "").match(/<[^>]+>/g) ?? [];
}

export function replySubject(subject: string | null | undefined): string {
  const s = (subject ?? "").trim() || "(no subject)";
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}
