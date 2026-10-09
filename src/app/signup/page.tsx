"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safeNext";
import ConfirmCodeForm from "@/components/ConfirmCodeForm";
import { isSchoolEmail, SCHOOL_EMAIL_TIP } from "@/lib/schoolEmail";
import { useRouter } from "next/navigation";
import { friendlyAuthError } from "@/lib/authMessages";

const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Other", "Prefer not to say"];
const ETHNICITY_OPTIONS = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Two or more races",
  "Other",
  "Prefer not to say",
];

function minBirthdate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 13);
  return d.toISOString().slice(0, 10);
}

export default function SignupPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [birthday, setBirthday] = useState("");
  const [gender, setGender] = useState("");
  const [ethnicity, setEthnicity] = useState("");
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");
  const router = useRouter();

  function nextPath() {
    return safeNext(new URLSearchParams(window.location.search).get("next"));
  }
  function redirectUrl() {
    return `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath())}`;
  }

  async function resend() {
    setResendState("sending");
    setError(null);
    const { error } = await supabase.auth.resend({ type: "signup", email: email.trim(), options: { emailRedirectTo: redirectUrl() } });
    if (error) {
      setResendState("idle");
      setError(friendlyAuthError(error.message));
      return;
    }
    setResendState("sent");
  }

  useEffect(() => {
    const qs = new URLSearchParams(window.location.search);
    const ref = qs.get("ref");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (ref) setReferralCode(ref.toUpperCase());
    const pre = qs.get("email");
    if (pre && pre.length < 255) setEmail(pre);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!birthday) {
      setError("Please enter your birthday.");
      return;
    }
    if (birthday > minBirthdate()) {
      setError("You must be at least 13 years old to sign up.");
      return;
    }
    if (!gender) {
      setError("Please select a gender.");
      return;
    }
    if (!ethnicity) {
      setError("Please select an ethnicity.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: redirectUrl(),
        data: {
          username: username.trim() || undefined,
          referral_code: referralCode || undefined,
          birthday,
          gender,
          ethnicity,
        },
      },
    });

    setLoading(false);
    if (error) {
      setError(friendlyAuthError(error.message));
      return;
    }
    // Supabase returns a user with no identities when the email is already
    // registered (it doesn't say so outright, to avoid leaking accounts).
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setError("An account with this email already exists. Sign in instead, or reset your password if you forgot it.");
      return;
    }
    // Email confirmation turned off: they're signed in already.
    if (data.session) {
      router.push(nextPath());
      router.refresh();
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="mx-auto max-w-sm px-5 py-12">
        <h1 className="mb-4 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Check your email
        </h1>
        <p style={{ color: "var(--text-dim)" }}>
          We sent a confirmation link to <strong>{email.trim()}</strong>. Tap it to activate your account, then
          sign in with the password you just chose.
        </p>
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm" style={{ color: "var(--text-faint)" }}>
          <li>Not there after a minute? Check your spam or promotions folder.</li>
          {isSchoolEmail(email) && <li><strong>School email:</strong> {SCHOOL_EMAIL_TIP}</li>}
          <li>The link works once and expires after 24 hours.</li>
          <li>You can&apos;t sign in until your email is confirmed.</li>
        </ul>
        <ConfirmCodeForm
          email={email}
          onConfirmed={() => {
            router.push(nextPath());
            router.refresh();
          }}
        />
        <button
          type="button"
          onClick={resend}
          disabled={resendState !== "idle"}
          className="mt-5 text-sm font-semibold underline disabled:no-underline disabled:opacity-70"
          style={{ color: "var(--red)" }}
        >
          {resendState === "sent" ? "New link sent." : resendState === "sending" ? "Sending…" : "Resend the email"}
        </button>
        {error && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        <p className="mt-5 text-sm">
          <Link href={`/login?next=${encodeURIComponent(nextPath())}`} className="font-semibold underline" style={{ color: "var(--red)" }}>
            Go to sign in
          </Link>
        </p>
      </div>
    );
  }

  const inputClass = "rounded-[10px] border px-3.5 py-2.5 text-sm";
  const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };

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
          className={inputClass}
          style={inputStyle}
        />
        <input
          type="email"
          required
          autoComplete="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
        {isSchoolEmail(email) && (
          <p className="-mt-2 rounded-lg p-2.5 text-xs" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
            🏫 {SCHOOL_EMAIL_TIP}
          </p>
        )}
        <input
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          placeholder="Password (min 6 chars)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          style={inputStyle}
        />

        <div>
          <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Birthday
          </label>
          <input
            type="date"
            required
            max={minBirthdate()}
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className={`w-full ${inputClass}`}
            style={inputStyle}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Gender
          </label>
          <select
            required
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className={`w-full ${inputClass}`}
            style={inputStyle}
          >
            <option value="" disabled>
              Select gender
            </option>
            {GENDER_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Ethnicity
          </label>
          <select
            required
            value={ethnicity}
            onChange={(e) => setEthnicity(e.target.value)}
            className={`w-full ${inputClass}`}
            style={inputStyle}
          >
            <option value="" disabled>
              Select ethnicity
            </option>
            {ETHNICITY_OPTIONS.map((eth) => (
              <option key={eth} value={eth}>
                {eth}
              </option>
          ))}
          </select>
        </div>

        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }} role="alert">
            {error}{" "}
            {error.includes("already exists") && (
              <Link href="/login" className="font-semibold underline">
                Sign in
              </Link>
            )}
          </p>
        )}
        <button type="submit" disabled={loading} className="bc-btn-red py-2.5 disabled:opacity-60">
          {loading ? "Creating account..." : "Sign up"}
        </button>
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          By signing up, you agree to our{" "}
          <Link href="/terms" target="_blank" className="underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="underline">
            Privacy Policy
          </Link>
          .
        </p>
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
