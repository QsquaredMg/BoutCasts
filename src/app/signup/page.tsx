"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setReferralCode(ref.toUpperCase());
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username: username || undefined,
          referral_code: referralCode || undefined,
        },
      },
    });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm px-5 py-12">
        <h1 className="mb-4 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Check your account
        </h1>
        <p style={{ color: "var(--text-dim)" }}>
          Account created. If email confirmation is required, check your inbox;
          otherwise you can{" "}
          <Link href="/login" className="font-semibold underline" style={{ color: "var(--red)" }}>
            sign in now
          </Link>
          .
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-12">
      <h1 className="mb-6 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Sign up
      </h1>
      {referralCode && (
        <p
          className="mb-4 rounded-xl p-3 text-xs"
          style={{ background: "var(--blue-soft)", color: "var(--blue)" }}
        >
          Signing up with invite code <strong>{referralCode}</strong>
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Username (optional)"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-[10px] border px-3.5 py-2.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-[10px] border px-3.5 py-2.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-[10px] border px-3.5 py-2.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
        {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}
        <button type="submit" disabled={loading} className="bc-btn-red py-2.5 disabled:opacity-60">
          {loading ? "Creating account..." : "Sign up"}
        </button>
      </form>
      <p className="mt-4 text-sm" style={{ color: "var(--text-faint)" }}>
        Already have an account?{" "}
        <Link href="/login" className="font-semibold underline" style={{ color: "var(--red)" }}>
          Sign in
        </Link>
      </p>
    </div>
  );
}
