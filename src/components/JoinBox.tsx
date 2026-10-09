"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveJoin } from "@/lib/joinResolve";

// The one join box. Works for a private event code, a prediction game code, a trivia game code,
// or a pasted BoutCasts link. No account needed to get in.
export default function JoinBox({
  initial = "",
  notFound = false,
  autoFocus = false,
  compact = false,
}: {
  initial?: string;
  notFound?: boolean;
  autoFocus?: boolean;
  compact?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(notFound ? "We couldn't find anything open with that code. Check it and try again." : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await resolveJoin(value, createClient(), window.location.hostname);
      if ("href" in r) {
        router.push(r.href);
        return;
      }
      setError(r.error);
    } catch {
      setError("Something went wrong. Try again.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={submit} className="w-full">
      <div className={compact ? "flex gap-2" : "flex flex-col gap-3"}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={autoFocus}
          autoCapitalize="characters"
          autoCorrect="off"
          autoComplete="off"
          spellCheck={false}
          inputMode="text"
          placeholder="Code or link"
          aria-label="Event code or link"
          className={
            compact
              ? "min-w-0 flex-1 rounded-full border px-4 py-2.5 text-sm font-semibold"
              : "w-full rounded-2xl border px-4 py-4 text-center text-2xl font-black tracking-wider"
          }
          style={{ borderColor: "var(--border)", background: "var(--surface)", fontFamily: compact ? undefined : "var(--font-display)" }}
        />
        <button
          type="submit"
          disabled={busy || value.trim().length < 4}
          className={`bc-btn-solid font-bold disabled:opacity-50 ${compact ? "rounded-full px-5 text-sm" : "rounded-full py-3 text-sm"}`}
        >
          {busy ? "Finding it…" : "Join"}
        </button>
      </div>
      {error && (
        <p role="alert" className={`mt-2 text-sm font-semibold ${compact ? "" : "text-center"}`} style={{ color: "var(--danger, var(--red))" }}>
          {error}
        </p>
      )}
    </form>
  );
}
