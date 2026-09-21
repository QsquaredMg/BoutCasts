"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type BoutOption = { id: string; title: string };
type PoolRow = { id: string; bout_id: string; goal_amount: number; raised: number; boutTitle: string };

export default function PrizePoolManager({
  boutsWithoutPool,
  initialPools,
}: {
  boutsWithoutPool: BoutOption[];
  initialPools: PoolRow[];
}) {
  const supabase = createClient();
  const [pools, setPools] = useState(initialPools);
  const [available, setAvailable] = useState(boutsWithoutPool);
  const [boutId, setBoutId] = useState(boutsWithoutPool[0]?.id ?? "");
  const [goal, setGoal] = useState(500);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!boutId) return;
    setError(null);
    setCreating(true);

    const { data, error } = await supabase
      .from("prize_pools")
      .insert({ bout_id: boutId, goal_amount: goal })
      .select()
      .single();

    setCreating(false);
    if (error) {
      setError(error.message);
      return;
    }

    const bout = available.find((b) => b.id === boutId);
    setPools((prev) => [
      { id: data.id, bout_id: boutId, goal_amount: goal, raised: 0, boutTitle: bout?.title ?? "" },
      ...prev,
    ]);
    setAvailable((prev) => prev.filter((b) => b.id !== boutId));
    setBoutId(available.filter((b) => b.id !== boutId)[0]?.id ?? "");
  }

  async function handleDelete(id: string) {
    setError(null);
    const { error } = await supabase.from("prize_pools").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setPools((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div>
      {error && (
        <p className="mb-3 text-sm" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}

      {available.length > 0 && (
        <form onSubmit={handleCreate} className="mb-5 flex flex-wrap items-center gap-2">
          <select
            value={boutId}
            onChange={(e) => setBoutId(e.target.value)}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
          >
            {available.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            value={goal}
            onChange={(e) => setGoal(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="w-28 rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text)" }}
          />
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            BB goal
          </span>
          <button
            type="submit"
            disabled={creating}
            className="bc-btn-solid rounded-full px-4 py-2 text-sm disabled:opacity-60"
          >
            {creating ? "Creating…" : "Create pool"}
          </button>
        </form>
      )}

      {pools.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          No prize pools yet.
        </p>
      ) : (
        <div className="bc-card overflow-hidden">
          {pools.map((p, i) => (
            <div
              key={p.id}
              className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
            >
              <div>
                <div className="text-sm font-bold">{p.boutTitle}</div>
                <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {p.raised} / {p.goal_amount} BB raised
                </div>
              </div>
              <button
                onClick={() => handleDelete(p.id)}
                className="text-xs font-medium"
                style={{ color: "var(--red)" }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
