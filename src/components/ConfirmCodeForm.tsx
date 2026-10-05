"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Confirm a new account by typing the code from the email instead of clicking
// the link. Helps when a school or work email scanner "clicks" (and uses up)
// the link before the person does, or the link opens in the wrong browser.
export default function ConfirmCodeForm({ email, onConfirmed }: { email: string; onConfirmed: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length < 6) return setError("Enter the code from the email.");
    setBusy(true);
    setError(null);
    const supabase = createClient();
    let { error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "signup" });
    if (err) ({ error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" }));
    setBusy(false);
    if (err) return setError("That code didn't work. Check it, or use the newest email if you asked for more than one.");
    onConfirmed();
  }

  return (
    <form onSubmit={submit} className="mt-4 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <label className="mb-1.5 block text-sm font-semibold" htmlFor="confirm-code">
        Got a code in the email? Enter it here
      </label>
      <div className="flex gap-2">
        <input
          id="confirm-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 12))}
          placeholder="123456"
          className="min-w-0 flex-1 rounded-[10px] border px-3 py-2 text-center text-lg tracking-[0.3em]"
          style={{ borderColor: "var(--border)", background: "var(--bg)" }}
        />
        <button type="submit" disabled={busy} className="bc-btn-red px-4 py-2 text-sm disabled:opacity-60">
          {busy ? "…" : "Confirm"}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-xs" style={{ color: "var(--danger)" }} role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
