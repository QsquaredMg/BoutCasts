"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Optional questions shown after someone votes, when the organizer has
// turned them on. Every question can be skipped; the organizer only ever
// sees totals, and groups under 5 are hidden.

const AGE = [
  ["13-17", "13–17"],
  ["18-24", "18–24"],
  ["25-34", "25–34"],
  ["35-44", "35–44"],
  ["45-54", "45–54"],
  ["55-64", "55–64"],
  ["65+", "65+"],
  ["prefer_not", "Prefer not to say"],
] as const;
const GENDER = [
  ["woman", "Woman"],
  ["man", "Man"],
  ["nonbinary", "Non-binary"],
  ["self_describe", "I describe myself another way"],
  ["prefer_not", "Prefer not to say"],
] as const;
const RACE = [
  ["american_indian_alaska_native", "American Indian or Alaska Native"],
  ["asian", "Asian"],
  ["black", "Black or African American"],
  ["hispanic_latino", "Hispanic or Latino"],
  ["middle_eastern_north_african", "Middle Eastern or North African"],
  ["native_hawaiian_pacific_islander", "Native Hawaiian or Pacific Islander"],
  ["white", "White"],
  ["multiracial", "Multiracial"],
  ["other", "Other"],
  ["prefer_not", "Prefer not to say"],
] as const;

export default function DemographicsPrompt({
  eventId,
  voterToken,
  onDone,
}: {
  eventId: string;
  voterToken: string | null;
  onDone: () => void;
}) {
  const supabase = createClient();
  const [over13, setOver13] = useState<boolean | null>(null);
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [race, setRace] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSaving(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("submit_live_vote_demographics", {
      p_event_id: eventId,
      p_voter_token: voterToken,
      p_age_range: age,
      p_gender: gender,
      p_race_ethnicity: race,
    });
    setSaving(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    onDone();
  }

  const box = "mb-4 rounded-xl border p-3.5";
  const boxStyle = { borderColor: "var(--border)", background: "var(--surface)" };
  const select = "w-full rounded-[10px] border px-3 py-2 text-sm";
  const selectStyle = { borderColor: "var(--border)", background: "var(--surface)" };

  if (over13 === false) return null;

  return (
    <div className={box} style={boxStyle}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          Optional — help the organizer understand who voted
        </p>
        <button type="button" onClick={onDone} className="text-xs font-semibold" style={{ color: "var(--text-faint)" }}>
          Skip
        </button>
      </div>
      <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
        Your answers aren&apos;t shown with your vote. The organizer only sees totals, and small groups
        are hidden.
      </p>

      {over13 === null ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setOver13(true)}
            className="flex-1 rounded-full border px-3 py-2 text-sm font-semibold"
            style={{ borderColor: "var(--border)" }}
          >
            I&apos;m 13 or older
          </button>
          <button
            type="button"
            onClick={() => {
              setOver13(false);
              onDone();
            }}
            className="flex-1 rounded-full border px-3 py-2 text-sm font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
          >
            I&apos;m under 13
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Age range
            <select className={`${select} mt-1`} style={selectStyle} value={age} onChange={(e) => setAge(e.target.value)}>
              <option value="">— Skip —</option>
              {AGE.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Gender
            <select className={`${select} mt-1`} style={selectStyle} value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="">— Skip —</option>
              {GENDER.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Race / ethnicity
            <select className={`${select} mt-1`} style={selectStyle} value={race} onChange={(e) => setRace(e.target.value)}>
              <option value="">— Skip —</option>
              {RACE.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={submit}
            disabled={saving || (!age && !gender && !race)}
            className="mt-1 rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            style={{ background: "var(--red)" }}
          >
            {saving ? "Saving…" : "Submit answers"}
          </button>
          {error && (
            <p className="text-xs" style={{ color: "var(--red)" }}>
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
