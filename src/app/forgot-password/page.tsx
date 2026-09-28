"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/authMessages";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpired(new URLSearchParams(window.location.search).get("notice") === "link_expired");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    setLoading(false);
    if (error) {
      setError(friendlyAuthError(error.message));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-sm px-5 py-12">
        <h1 className="mb-4 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Check your email
        </h1>
        <p style={{ color: "var(--text-dim)" }}>
          If an account exists for <strong>{email}</strong>, we sent a link to reset your password.
          Check your spam folder if it doesn&apos;t arrive in a minute. The link works once.
        </p>
        <p className="mt-4 text-sm">
          <Link href="/login" className="font-semibold underline" style={{ color: "var(--red)" }}>
            Back to sign in
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-12">
      <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Reset your password
      </h1>
      {expired && (
        <p className="mb-4 rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-dim)" }}>
          That reset link expired or was already used. Request a new one below and open it on this device.
        </p>
      )}
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Enter your email and we&apos;ll send you a link to reset your password.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-[10px] border px-3.5 py-2.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
        {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        <button type="submit" disabled={loading} className="bc-btn-red py-2.5 disabled:opacity-60">
          {loading ? "Sending..." : "Send reset link"}
        </button>
      </form>
      <p className="mt-4 text-sm" style={{ color: "var(--text-faint)" }}>
        <Link href="/login" className="font-semibold underline" style={{ color: "var(--red)" }}>
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
