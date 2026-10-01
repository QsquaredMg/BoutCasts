"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function clean(v: string) {
  return v.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}

function JoinForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [code, setCode] = useState(() => clean(params.get("code") ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("notfound") ? "We couldn't find an open event with that code. Check it and try again." : null
  );

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return setError("Codes are 6 letters and numbers.");
    setBusy(true);
    setError(null);
    const { data } = await createClient().rpc("find_event_by_code", { p_code: code });
    setBusy(false);
    if (typeof data === "string" && data) router.push(`/vote/${data}`);
    else setError("We couldn't find an open event with that code. Check it and try again.");
  }

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-5 py-14 text-center">
      <div className="mb-3 text-4xl" aria-hidden>
        🔒
      </div>
      <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Join an event
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
        Enter the code from your school, team or event organizer.
      </p>
      <form onSubmit={submit} className="mt-6 flex w-full flex-col gap-3">
        <input
          value={code}
          onChange={(e) => setCode(clean(e.target.value))}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          autoFocus
          placeholder="ABC123"
          aria-label="Event code"
          className="w-full rounded-2xl border px-4 py-4 text-center text-3xl font-black tracking-[0.35em]"
          style={{ borderColor: "var(--border)", background: "var(--surface)", fontFamily: "var(--font-display)" }}
        />
        <button type="submit" disabled={busy || code.length !== 6} className="bc-btn-solid rounded-full py-3 text-sm font-bold disabled:opacity-50">
          {busy ? "Finding your event…" : "Join"}
        </button>
      </form>
      {error && (
        <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <p className="mt-8 text-xs" style={{ color: "var(--text-faint)" }}>
        Private events don&apos;t appear anywhere public on BoutCasts. Only people with the link, code or QR code can vote.
      </p>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  );
}
