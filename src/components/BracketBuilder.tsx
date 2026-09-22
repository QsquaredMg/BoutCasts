"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ClipSourceTag from "@/components/ClipSourceTag";
import type { Category } from "@/lib/types";

type SubmissionRow = {
  id: string;
  title: string;
  category_id: string;
  crew_name: string | null;
  source_type: string;
  source_url: string | null;
  created_at: string;
  used: boolean;
  profiles?: { username: string | null } | null;
};

export default function BracketBuilder({
  categories,
  submissions,
}: {
  categories: Category[];
  submissions: SubmissionRow[];
}) {
  const supabase = createClient();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  // Ordered selection — order determines seeding (1st picked = seed 1, etc).
  const [selected, setSelected] = useState<string[]>([]);
  const [bracketKey, setBracketKey] = useState("");
  const [titlePrefix, setTitlePrefix] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const inCategory = useMemo(
    () => submissions.filter((s) => s.category_id === categoryId),
    [submissions, categoryId]
  );

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const n = selected.length;
  const isPowerOfTwo = n >= 2 && (n & (n - 1)) === 0;
  const needsKey = n > 2;

  async function handleCreate() {
    setError(null);
    setSuccess(null);
    if (!isPowerOfTwo) {
      setError("Pick a power-of-two number of clips (2, 4, 8, 16...).");
      return;
    }
    if (needsKey && !bracketKey.trim()) {
      setError("A bracket key is required for more than 2 competitors.");
      return;
    }

    setSubmitting(true);
    const { data, error: rpcError } = await supabase.rpc("create_bracket_from_submissions", {
      p_category_id: categoryId,
      p_submission_ids: selected,
      p_bracket_key: needsKey ? bracketKey.trim() : null,
      p_title_prefix: titlePrefix.trim() || null,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const createdIds = (data as string[]) ?? [];
    setSuccess(
      needsKey
        ? `Bracket created — ${createdIds.length} bout${createdIds.length === 1 ? "" : "s"}.`
        : "Bout created and live."
    );
    setSelected([]);
    setBracketKey("");
    setTitlePrefix("");
  }

  return (
    <div className="bc-card p-5">
      <h2 className="mb-1 text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Build a bracket from approved clips
      </h2>
      <p className="mb-4 text-xs" style={{ color: "var(--text-faint)" }}>
        Pick a power-of-two number of approved submissions in seed order (click order = seed
        order). 2 competitors creates a single live bout; 4, 8, 16... builds a full
        single-elimination bracket, seeded round 1 through the champion slot.
      </p>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCategoryId(c.id);
              setSelected([]);
            }}
            className="rounded-full border px-3 py-1 text-xs font-semibold"
            style={{
              borderColor: categoryId === c.id ? "var(--blue)" : "var(--border)",
              background: categoryId === c.id ? "var(--blue-soft)" : "var(--surface)",
              color: categoryId === c.id ? "var(--blue)" : "var(--text-dim)",
            }}
          >
            {c.name}
          </button>
        ))}
      </div>

      {inCategory.length === 0 ? (
        <p className="mb-4 text-sm" style={{ color: "var(--text-faint)" }}>
          No approved, unused submissions in this category yet.
        </p>
      ) : (
        <div className="mb-4 flex flex-col gap-1.5">
          {inCategory.map((s) => {
            const seedIndex = selected.indexOf(s.id);
            const isSelected = seedIndex !== -1;
            const name = s.crew_name || s.profiles?.username || "Unknown";
            return (
              <button
                key={s.id}
                type="button"
                disabled={s.used}
                onClick={() => toggle(s.id)}
                className="flex items-center gap-3 rounded-xl border px-3 py-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  borderColor: isSelected ? "var(--blue)" : "var(--border)",
                  background: isSelected ? "var(--blue-soft)" : "var(--surface)",
                }}
              >
                <span
                  className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold"
                  style={{
                    background: isSelected ? "var(--blue)" : "var(--surface-2)",
                    color: isSelected ? "#fff" : "var(--text-faint)",
                  }}
                >
                  {isSelected ? seedIndex + 1 : ""}
                </span>
                <span className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{name}</div>
                  <div className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                    {s.title}
                  </div>
                </span>
                <ClipSourceTag sourceType={s.source_type} sourceUrl={s.source_url} />
                {s.used && (
                  <span className="text-[10px] font-bold uppercase" style={{ color: "var(--text-faint)" }}>
                    Already in a bout
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Bracket key {needsKey ? "(required)" : "(not needed for a single bout)"}
          </label>
          <input
            value={bracketKey}
            onChange={(e) => setBracketKey(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
            placeholder="e.g. sound-city-open"
            disabled={!needsKey}
            className="w-full rounded-lg border px-3 py-2 text-sm disabled:opacity-50"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
            Title / tournament name (optional)
          </label>
          <input
            value={titlePrefix}
            onChange={(e) => setTitlePrefix(e.target.value)}
            placeholder="e.g. Sound City Open"
            className="w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)" }}
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={submitting || !isPowerOfTwo}
          className="rounded-full px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          style={{ background: "var(--blue)" }}
        >
          {submitting ? "Creating..." : n > 0 ? `Create (${n} picked)` : "Pick clips first"}
        </button>
      </div>

      {n > 0 && !isPowerOfTwo && (
        <p className="mt-2 text-xs font-semibold" style={{ color: "var(--red)" }}>
          {n} selected — needs to be a power of two (2, 4, 8, 16...).
        </p>
      )}
      {error && (
        <p className="mt-2 text-xs font-semibold" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
      {success && (
        <p className="mt-2 text-xs font-semibold" style={{ color: "var(--blue)" }}>
          {success}
        </p>
      )}
    </div>
  );
}
