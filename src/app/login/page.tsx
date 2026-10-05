"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safeNext";
import ConfirmCodeForm from "@/components/ConfirmCodeForm";
import { isSchoolEmail, SCHOOL_EMAIL_TIP } from "@/lib/schoolEmail";
import { classifyAuthError, friendlyAuthError, LOGIN_NOTICES, type AuthProblem } from "@/lib/authMessages";

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
  const [problem, setProblem] = useState<AuthProblem | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const searchParams = useSearchParams();
  // Where to send the user after signing in (e.g. back to /live-vote/new).
  const next = safeNext(searchParams.get("next"));
  // No specific destination asked for → send people to their own profile.
  const hasNext = !!searchParams.get("next") && next !== "/";

  useEffect(() => {
    // ?notice=... from our auth routes, or #error_code=... straight from Supabase.
    const fromQuery = searchParams.get("notice") ?? (searchParams.get("error") ? "link_expired" : null);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const fromHash = hash.get("error_code") || hash.get("error") ? "link_expired" : null;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNotice(fromQuery ?? fromHash);
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setProblem(null);
    setResendState("idle");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    setLoading(false);
    if (error) {
      setProblem(classifyAuthError(error.message));
      setError(friendlyAuthError(error.message));
      return;
    }
    let dest = next;
    if (!hasNext && data.user) {
      const [{ data: profile }, { count: events }] = await Promise.all([
        supabase.from("profiles").select("username").eq("id", data.user.id).maybeSingle(),
        supabase.from("live_vote_events").select("id", { count: "exact", head: true }).eq("organizer_id", data.user.id),
      ]);
      // Organizers land on their events; everyone else on their profile.
      if ((events ?? 0) > 0) dest = "/live-vote";
      else if (profile?.username) dest = `/profile/${encodeURIComponent(profile.username)}`;
    }
    router.push(dest);
    router.refresh();
  }

  async function resendConfirmation() {
    setResendState("sending");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
    });
    if (error) {
      setResendState("idle");
      setError(friendlyAuthError(error.message));
      return;
    }
    setResendState("sent");
  }

  const n = notice ? LOGIN_NOTICES[notice] : null;

  return (
    <div className="mx-auto max-w-sm px-5 py-12">
      <h1 className="mb-6 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Sign in
      </h1>
      {n && (
        <p
          className="mb-4 rounded-xl border p-3 text-sm"
          role="status"
          style={{
            borderColor: n.tone === "ok" ? "var(--red)" : "var(--border)",
            background: "var(--surface)",
            color: "var(--text-dim)",
          }}
        >
          {n.text}
        </p>
      )}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-[10px] border px-3.5 py-2.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
        <input
          type="password"
          required
          autoComplete="current-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-[10px] border px-3.5 py-2.5 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
        {error && (
          <div className="text-sm" style={{ color: "var(--danger)" }} role="alert">
            <p>{error}</p>
            {problem === "unconfirmed" && (
              <button
                type="button"
                onClick={resendConfirmation}
                disabled={resendState !== "idle" || !email}
                className="mt-2 font-semibold underline disabled:no-underline disabled:opacity-70"
                style={{ color: "var(--red)" }}
              >
                {resendState === "sent"
                  ? `New link sent to ${email.trim()} — check your inbox and spam.`
                  : resendState === "sending"
                    ? "Sending…"
                    : "Resend confirmation email"}
              </button>
            )}
            {problem === "unconfirmed" && isSchoolEmail(email) && (
              <p className="mt-2 text-xs" style={{ color: "var(--text-dim)" }}>
                🏫 {SCHOOL_EMAIL_TIP}
              </p>
            )}
            {problem === "bad_credentials" && (
              <Link href="/forgot-password" className="mt-2 block font-semibold underline" style={{ color: "var(--red)" }}>
                Reset my password
              </Link>
            )}
          </div>
        )}
        <button type="submit" disabled={loading} className="bc-btn-red py-2.5 disabled:opacity-60">
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
      {problem === "unconfirmed" && email && (
        <ConfirmCodeForm
          email={email}
          onConfirmed={() => {
            router.push(next);
            router.refresh();
          }}
        />
      )}
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
