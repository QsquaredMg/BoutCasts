"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

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

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref) setReferralCode(ref.toUpperCase());
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

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        data: {
          username: username || undefined,
          referral_code: referralCode || undefined,
          birthday,
          gender,
          ethnicity,
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
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
          style={inputStyle}
        />
        <input
          type="password"
          required
          minLength={6}
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
