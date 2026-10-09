"use client";

import { useEffect, useRef, useState } from "react";
import { readGuestProfile } from "@/lib/guestPass";

// The one-field-or-two card shown the first time a guest acts. Name always; email when asked.
export default function GuestPassCard({
  askEmail,
  headline = "Who's voting?",
  button = "Continue",
  onSubmit,
  onCancel,
}: {
  askEmail: boolean;
  headline?: string;
  button?: string;
  /** Return an error message to show, or null when it worked. */
  onSubmit: (name: string, email: string) => Promise<string | null>;
  onCancel?: () => void;
}) {
  const saved = typeof window === "undefined" ? { name: "", email: "" } : readGuestProfile();
  const [name, setName] = useState(saved.name);
  const [email, setEmail] = useState(saved.email);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLFormElement | null>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const m = await onSubmit(name.trim(), email.trim());
    setBusy(false);
    if (m) setErr(m);
  }

  const inp = "w-full rounded-xl border px-3 py-3 text-base";
  return (
    <form ref={ref} onSubmit={go} className="col-span-full rounded-2xl border-2 p-4" style={{ borderColor: "var(--blue)", background: "var(--surface)" }}>
      <p className="text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{headline}</p>
      <p className="mb-3 text-sm" style={{ color: "var(--text-faint)" }}>
        No account or password needed.{askEmail ? " We use your email to save your votes so you can finish an account later." : ""}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <input className={inp} placeholder={askEmail ? "Your name" : "Your name or nickname"} value={name} onChange={(e) => setName(e.target.value)} maxLength={40} autoComplete="given-name" required autoFocus style={{ borderColor: "var(--border)" }} />
        {askEmail && (
          <input className={inp} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} autoComplete="email" required style={{ borderColor: "var(--border)" }} />
        )}
      </div>
      {err && <p className="mt-2 text-sm font-medium" style={{ color: "var(--red)" }}>{err}</p>}
      <div className="mt-3 flex items-center gap-3">
        <button type="submit" disabled={busy || !name.trim() || (askEmail && !email.trim())} className="rounded-full px-5 py-3 text-sm font-bold text-white disabled:opacity-50" style={{ background: "var(--blue)" }}>
          {busy ? "One moment…" : button}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="text-sm underline" style={{ color: "var(--text-faint)" }}>Cancel</button>}
      </div>
    </form>
  );
}
