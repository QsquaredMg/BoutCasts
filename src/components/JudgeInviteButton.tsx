"use client";

import { useState } from "react";

// "Email invite" next to a judge: a prewritten letter telling them they've been
// chosen as a judge, with their private link. Opens the organizer's own email
// app (to, subject and letter filled in) so it comes from them; the letter can
// be edited first or copied into any app.

export type JudgeInviteKind = "bout" | "competition" | "debate" | "showcase";

function letter(o: { judgeName: string; title: string; kind: JudgeInviteKind; link: string; criteria?: string[]; deadline?: string | null; from?: string }) {
  const what =
    o.kind === "debate" ? "debate" : o.kind === "showcase" ? "showcase competition" : o.kind === "competition" ? "competition" : "bout";
  const scoring = o.criteria?.length
    ? `As a judge, you'll watch each entry and score it from 1 to 10 on ${o.criteria.slice(0, -1).join(", ")}${o.criteria.length > 1 ? " and " : ""}${o.criteria[o.criteria.length - 1]}.`
    : "As a judge, you'll watch each entry and enter your scores.";
  const deadline = o.deadline
    ? `\nPlease submit your scores by ${new Date(o.deadline).toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}.\n`
    : "";
  return {
    subject: `You've been selected as a judge: ${o.title}`,
    body: `Hi ${o.judgeName},

Congratulations! You've been selected to serve as a judge for the ${what} "${o.title}" on BoutCasts.

${scoring} Your scores help decide the winner, so we're grateful to have your expertise.

Your private judging link:
${o.link}

No account or password is needed. Just open the link on your phone or computer. Please don't share it; it's unique to you.
${deadline}
Thank you for being part of this. If you have any questions, simply reply to this email.

${o.from ? `${o.from}\n` : ""}Sent with BoutCasts (boutcasts.com)`,
  };
}

export default function JudgeInviteButton({
  judgeName,
  link,
  title,
  kind,
  criteria,
  deadline,
}: {
  judgeName: string;
  /** Judging URL or path, e.g. /showcase/judge/abc */
  link: string;
  title: string;
  kind: JudgeInviteKind;
  criteria?: string[];
  deadline?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [from, setFrom] = useState("");
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState(false);

  function start() {
    // Relative paths are resolved here (in the browser) so the button can render on the server.
    const full = /^https?:\/\//.test(link) ? link : new URL(link, window.location.origin).toString();
    setDraft(letter({ judgeName, title, kind, link: full, criteria, deadline }));
    setOpen(true);
  }

  function withSignature() {
    if (!draft) return draft;
    if (!from.trim()) return draft;
    return { ...draft, body: draft.body.replace("Sent with BoutCasts", `${from.trim()}\nSent with BoutCasts`) };
  }

  function send() {
    const d = withSignature();
    if (!d) return;
    const href = `mailto:${encodeURIComponent(email.trim())}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
    window.location.href = href;
  }

  async function copyLetter() {
    const d = withSignature();
    if (!d) return;
    try {
      await navigator.clipboard.writeText(`Subject: ${d.subject}\n\n${d.body}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the letter is still visible to select by hand
    }
  }

  const box = { borderColor: "var(--border)", background: "var(--surface)" };
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <>
      <button type="button" onClick={start} className="text-xs font-bold" style={{ color: "var(--red)" }}>
        ✉️ Email invite
      </button>
      {open && draft && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center p-3 sm:items-center"
          style={{ background: "rgba(10,14,26,.6)" }}
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Invite ${judgeName} to judge`}
        >
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border p-5" style={box} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                  Judge invitation
                </p>
                <p className="font-semibold">{judgeName}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="px-1 text-lg" style={{ color: "var(--text-faint)" }} aria-label="Close">
                ✕
              </button>
            </div>

            <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
              Judge&apos;s email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="judge@example.com"
              className="mb-3 w-full rounded-[10px] border px-3 py-2 text-sm"
              style={box}
              autoFocus
            />
            <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
              Sign it as (optional)
            </label>
            <input
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              placeholder="e.g. Coach Williams, Jim Hill High Band"
              className="mb-3 w-full rounded-[10px] border px-3 py-2 text-sm"
              style={box}
            />
            <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
              Subject
            </label>
            <input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              className="mb-3 w-full rounded-[10px] border px-3 py-2 text-sm"
              style={box}
            />
            <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
              Letter (you can edit it)
            </label>
            <textarea
              value={draft.body}
              onChange={(e) => setDraft({ ...draft, body: e.target.value })}
              rows={14}
              className="mb-3 w-full rounded-[10px] border px-3 py-2 text-sm leading-relaxed"
              style={box}
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={send}
                disabled={!validEmail}
                className="bc-btn-solid rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-50"
              >
                Open in my email app
              </button>
              <button type="button" onClick={copyLetter} className="rounded-full border px-4 py-2.5 text-sm font-bold" style={{ borderColor: "var(--border)" }}>
                {copied ? "Copied!" : "Copy letter"}
              </button>
            </div>
            <p className="mt-2 text-[11px]" style={{ color: "var(--text-faint)" }}>
              The email is sent from your own email account, so replies come straight to you.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
