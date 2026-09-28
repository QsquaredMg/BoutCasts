"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function OrgJoin({ token }: { token: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);

  async function join() {
    setBusy(true);
    setError(null);
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setBusy(false);
      setNeedsLogin(true);
      return;
    }
    const { error: rpcError } = await supabase.rpc("join_organization", { p_token: token });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.push("/org");
  }

  const next = encodeURIComponent(`/org/join/${token}`);
  return (
    <div className="text-center">
      <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Join your team&apos;s license
      </h1>
      <p className="mb-5 text-sm" style={{ color: "var(--text-dim)" }}>
        You&apos;ve been invited to a BoutCasts School &amp; League License. Joining gives your account
        unlimited Live Votes with Pro analytics, paid for by your organization.
      </p>
      {needsLogin ? (
        <p className="text-sm">
          <Link href={`/login?next=${next}`} className="font-semibold underline" style={{ color: "var(--red)" }}>
            Sign in
          </Link>{" "}
          or{" "}
          <Link href={`/signup?next=${next}`} className="font-semibold underline" style={{ color: "var(--red)" }}>
            create a free account
          </Link>
          , then come back to this link.
        </p>
      ) : (
        <button onClick={join} disabled={busy} className="bc-btn-solid rounded-full px-6 py-3 text-sm font-bold disabled:opacity-60">
          {busy ? "Joining…" : "Join the license"}
        </button>
      )}
      {error && (
        <p className="mt-3 text-sm" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
