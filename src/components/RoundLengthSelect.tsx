"use client";

// How long each bracket round stays open once both competitors are set.
// Chosen when the bracket is built; the database starts each round's clock
// the moment the round goes live (see create_bracket_* / close_bout_internal).
export const ROUND_LENGTH_OPTIONS: { label: string; minutes: number | null }[] = [
  { label: "1 hour", minutes: 60 },
  { label: "4 hours", minutes: 240 },
  { label: "12 hours", minutes: 720 },
  { label: "24 hours", minutes: 1440 },
  { label: "42 hours (standard)", minutes: 2520 },
  { label: "3 days", minutes: 4320 },
  { label: "7 days", minutes: 10080 },
  { label: "No auto-close — I'll close rounds myself", minutes: null },
];

export const DEFAULT_ROUND_MINUTES = 2520;

export default function RoundLengthSelect({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (minutes: number | null) => void;
}) {
  return (
    <div className="flex-1">
      <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
        Round length (each round closes automatically)
      </label>
      <select
        value={value === null ? "manual" : String(value)}
        onChange={(e) => onChange(e.target.value === "manual" ? null : Number(e.target.value))}
        className="w-full rounded-lg border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        {ROUND_LENGTH_OPTIONS.map((o) => (
          <option key={o.label} value={o.minutes === null ? "manual" : String(o.minutes)}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
