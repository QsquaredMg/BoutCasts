"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/authMessages";
import { postLoginPath } from "@/lib/postLoginPath";

type Providers = { google: boolean; apple: boolean };

// Which social sign-ins are switched on in Supabase. Asked once per page load; a provider that isn't
// enabled never shows a button, so nobody lands on a dead "provider is not enabled" error.
let providersPromise: Promise<Providers> | null = null;
function loadProviders(): Promise<Providers> {
  if (!providersPromise) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    providersPromise = fetch(`${url}/auth/v1/settings`, { headers: { apikey: key ?? "" } })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => ({ google: !!j?.external?.google, apple: !!j?.external?.apple }))
      .catch(() => ({ google: false, apple: false }));
  }
  return providersPromise;
}

// Passwordless sign-in / sign-up: social buttons and an emailed one-time code. The same code works for
// brand-new and returning people, so there is no password to forget.
export default function PasswordlessAuth({
  next,
  hasNext,
  referral,
  initialEmail = "",
  intro,
}: {
  next: string;
  hasNext: boolean;
  referral?: string | null;
  initialEmail?: string;
  intro?: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [providers, setProviders] = useState<Providers>({ google: false, apple: false });
  const [email, setEmail] = useState(initialEmail);
  const [step, setStep] = useState<"closed" | "email" | "code">("closed");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    loadProviders().then((p) => alive && setProviders(p));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  const redirectTo = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

  async function social(provider: "google" | "apple") {
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } });
    if (err) {
      setBusy(false);
      setError(friendlyAuthError(err.message));
    }
  }

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const addr = email.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) return setError("Enter a valid email address.");
    setError(null);
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: addr,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectTo(),
        data: referral ? { referral_code: referral } : undefined,
      },
    });
    setBusy(false);
    if (err) return setError(friendlyAuthError(err.message));
    setCode("");
    setStep("code");
    setCooldown(30);
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    const token = code.replace(/\D/g, "");
    if (token.length < 6) return setError("Enter the code from the email.");
    setError(null);
    setBusy(true);
    const addr = email.trim();
    let res = await supabase.auth.verifyOtp({ email: addr, token, type: "email" });
    if (res.error) res = await supabase.auth.verifyOtp({ email: addr, token, type: "signup" });
    if (res.error || !res.data.user) {
      setBusy(false);
      return setError("That code didn't work. Check it, or use the newest email if you asked for more than one.");
    }
    const dest = await postLoginPath(supabase, res.data.user, next, hasNext);
    router.push(dest);
    router.refresh();
  }

  const showSocial = providers.google || providers.apple;

  return (
    <div className="flex flex-col gap-3">
      {intro && (
        <p className="text-sm" style={{ color: "var(--text-dim)" }}>
          {intro}
        </p>
      )}

      {showSocial && (
        <div className="flex flex-col gap-2">
          {providers.google && (
            <button type="button" onClick={() => social("google")} disabled={busy} className="flex items-center justify-center gap-2.5 rounded-full border py-2.5 text-sm font-bold disabled:opacity-60" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <GoogleMark /> Continue with Google
            </button>
          )}
          {providers.apple && (
            <button type="button" onClick={() => social("apple")} disabled={busy} className="flex items-center justify-center gap-2.5 rounded-full border py-2.5 text-sm font-bold disabled:opacity-60" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <AppleMark /> Continue with Apple
            </button>
          )}
        </div>
      )}

      {step === "closed" && (
        <button
          type="button"
          onClick={() => setStep("email")}
          className="flex items-center justify-center gap-2 rounded-full border py-2.5 text-sm font-bold"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <span aria-hidden>✉️</span> Email me a code. No password.
        </button>
      )}

      {step === "email" && (
        <form onSubmit={sendCode} className="flex flex-col gap-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <label htmlFor="pl-email" className="text-sm font-semibold">
            We&apos;ll email you a code. New here? This creates your account.
          </label>
          <input
            id="pl-email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-[10px] border px-3.5 py-2.5 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--bg)" }}
          />
          <button type="submit" disabled={busy} className="bc-btn-red py-2.5 text-sm disabled:opacity-60">
            {busy ? "Sending…" : "Email me a code"}
          </button>
        </form>
      )}

      {step === "code" && (
        <form onSubmit={verify} className="flex flex-col gap-2 rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <label htmlFor="pl-code" className="text-sm font-semibold">
            Enter the code we sent to {email.trim()}
          </label>
          <input
            id="pl-code"
            ref={codeRef}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, "").slice(0, 12))}
            placeholder="123456"
            className="rounded-[10px] border px-3 py-2.5 text-center text-2xl tracking-[0.3em]"
            style={{ borderColor: "var(--border)", background: "var(--bg)" }}
          />
          <button type="submit" disabled={busy} className="bc-btn-red py-2.5 text-sm disabled:opacity-60">
            {busy ? "Checking…" : "Sign in"}
          </button>
          <div className="flex items-center justify-between text-xs" style={{ color: "var(--text-dim)" }}>
            <button type="button" onClick={() => setStep("email")} className="underline">
              Use a different email
            </button>
            <button type="button" onClick={() => sendCode()} disabled={cooldown > 0 || busy} className="underline disabled:no-underline disabled:opacity-60">
              {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
            </button>
          </div>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>
            Check spam if you don&apos;t see it. The code works once and expires in an hour.
          </p>
        </form>
      )}

      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <p className="text-xs" style={{ color: "var(--text-faint)" }}>
        By continuing you confirm you&apos;re 13 or older and agree to our{" "}
        <Link href="/terms" target="_blank" className="underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" target="_blank" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.8 6.1C12.3 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.4 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.9-4.7l-7.8-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.8-6.1z" />
      <path fill="#34A853" d="M24 48c6.2 0 11.4-2 15.2-5.5l-7.5-5.8c-2.1 1.4-4.7 2.3-7.7 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M16.4 12.6c0-2.4 2-3.5 2.1-3.6-1.2-1.7-3-1.9-3.6-1.9-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3.1-.5 7.6 1.3 10.1.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.3-.8s2 .8 3.3.8c1.4 0 2.3-1.2 3.1-2.4 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.9-1.1-2.9-4.3zM14 5.4c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z" />
    </svg>
  );
}
