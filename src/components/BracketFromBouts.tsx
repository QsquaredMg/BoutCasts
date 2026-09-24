"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";

type BoutRow = {
  id: string;
  category_id: string;
  title: string;
  competitor_a_name: string;
  competitor_b_name: string;
  status: string;
  created_at: string;
};

export default function BracketFromBouts({
  categories,
  bouts,
}: {
  categories: Category[];
  bouts: BoutRow[];
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
    () =>
      bouts
        .filter((b) => b.category_id === categoryId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [bouts, categoryId]
  );

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const n = selected.length;
  const isPowerOfTwo = n >= 2 && (n & (n - 1)) === 0;
  const needsKey = n > 1;

  async function handleCreate() {
    setError(null);
    setSuccess(null);
    if (!isPowerOfTwo) {
      setError("Pick a power-of-two number of bouts (2, 4, 8, 16...).");
      return;
    }
    if (needsKey && !bracketKey.trim()) {
      setError("A bracket key is required for more than one bout.");
      return;
    }

    setSubmitting(true);
    const { data, error: rpcError } = await supabase.rpc("create_bracket_from_bouts", {
      p_bout_ids: selected,
      p_bracket_key: needsKey ? bracketKey.trim() : null,
      p_title_prefix: titlePrefix.trim() || null,
    });
    setSubmitting(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    const createdIds = (data as string[]) ?? [];
    setSuccess(`Bracket created — ${createdIds.length} bout${createdIds.length === 1 ? "" : "s"} total.`);
    setSelected([]);
    setBracketKey("");
    setTitlePrefix("");
  }

  return (
    <div className="bc-card mt-4 p-5">
      <h2 className="mb-1 text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Build a bracket from bouts you already created
      </h2>
      <p className="mb-4 text-xs" style={{ color: "var(--text-faint)" }}>
        Already curated your first-round matchups above (or via BoutCurator)? Pick a power-of-two
        number of them here, in seed order (click order = seed order), and this builds every
        later round automatically — you don&apos;t need a bracket key for a single bout, but one
        is required once you&apos;re bracketing more than one.
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
          No un-bracketed bouts in this category yet. Create some with BoutCurator above, then
          come back here to bracket them.
        </p>
      ) : (
        <div className="mb-4 flex flex-col gap-1.5">
          {inCategory.map((b) => {
            const seedIndex = selected.indexOf(b.id);
            const isSelected = seedIndex !== -1;
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => toggle(b.id)}
                className="flex items-center gap-3 rounded-xl border px-3 py-2 text-left"
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
                  <div className="truncate text-sm font-semibold">
                    {b.competitor_a_name} vs {b.competitor_b_name}
                  </div>
                  <div className="truncate text-xs" style={{ color: "var(--text-faint)" }}>
                    {b.title}
                  </div>
                </span>
                <span
                  className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                  style={{ background: "var(--surface-2)", color: "var(--text-faint)" }}
                >
                  {b.status}
                </span>
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
            placeholder="e.g. hbcu-classic-2026"
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
            placeholder="e.g. HBCU Classic 2026"
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
          {submitting ? "Creating..." : n > 0 ? `Create (${n} picked)` : "Pick bouts first"}
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
