"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safeNext";

export default function LoginPage() {
  // useSearchParams needs a Suspense boundary so the page can still prerender.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  // Where to send the user after signing in (e.g. back to /live-vote/new).
  const next = safeNext(searchParams.get("next"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-sm px-5 py-12">
      <h1 className="mb-6 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Sign in
      </h1>
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
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-[10px] border px-3.5 py-2.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
        {error && <p className="text-sm" style={{ color: "var(--red)" }}>{error}</p>}
        <button type="submit" disabled={loading} className="bc-btn-red py-2.5 disabled:opacity-60">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="mt-3 text-sm">
        <Link href="/forgot-password" className="font-semibold underline" style={{ color: "var(--text-dim)" }}>
          Forgot password?
        </Link>
      </p>
      <p className="mt-4 text-sm" style={{ color: "var(--text-faint)" }}>
        No account?{" "}
        <Link href={next !== "/" ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="font-semibold underline" style={{ color: "var(--red)" }}>
          Sign up
        </Link>
      </p>
    </div>
  );
}
