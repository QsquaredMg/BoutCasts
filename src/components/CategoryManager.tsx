"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";

export default function CategoryManager({
  initialCategories,
  sponsors,
}: {
  initialCategories: Category[];
  sponsors: { id: string; name: string }[];
}) {
  const supabase = createClient();
  const [categories, setCategories] = useState(
    [...initialCategories].sort((a, b) => a.sort_order - b.sort_order)
  );
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setCreating(true);
    const nextSortOrder = categories.length > 0 ? Math.max(...categories.map((c) => c.sort_order)) + 1 : 0;

    const { data, error } = await supabase
      .from("categories")
      .insert({ name, sort_order: nextSortOrder })
      .select()
      .single();

    setCreating(false);
    if (error) {
      setError(error.message);
      return;
    }
    setCategories((prev) => [...prev, data as Category]);
    setName("");
  }

  async function rename(id: string, newName: string) {
    setError(null);
    const { error } = await supabase.from("categories").update({ name: newName }).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, name: newName } : c)));
  }

  async function assignSponsor(id: string, sponsorId: string | null) {
    setError(null);
    const { error } = await supabase.from("categories").update({ sponsor_id: sponsorId }).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setCategories((prev) => prev.map((c) => (c.id === id ? { ...c, sponsor_id: sponsorId } : c)));
  }

  async function move(id: string, direction: -1 | 1) {
    const idx = categories.findIndex((c) => c.id === id);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= categories.length) return;

    const a = categories[idx];
    const b = categories[swapIdx];
    setSavingId(id);
    setError(null);

    const [{ error: e1 }, { error: e2 }] = await Promise.all([
      supabase.from("categories").update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("categories").update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);

    setSavingId(null);
    if (e1 || e2) {
      setError(e1?.message ?? e2?.message ?? "Failed to reorder");
      return;
    }

    const reordered = [...categories];
    reordered[idx] = { ...b, sort_order: a.sort_order };
    reordered[swapIdx] = { ...a, sort_order: b.sort_order };
    setCategories(reordered.sort((x, y) => x.sort_order - y.sort_order));
  }

  async function handleDelete(id: string) {
    setError(null);
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setCategories((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}

      <section>
        <h3 className="mb-3 text-lg font-semibold">Add a category</h3>
        <form onSubmit={handleCreate} className="flex gap-3 rounded-lg border border-neutral-200 bg-white p-4">
          <input
            type="text"
            required
            placeholder="Category name (e.g. Dance, Rap, Debate)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {creating ? "Adding..." : "Add"}
          </button>
        </form>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">All categories</h3>
        {categories.length === 0 ? (
          <p className="text-sm text-neutral-500">No categories yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {categories.map((c, i) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white p-3"
              >
                <div className="flex items-center gap-2">
                  <div className="flex flex-col">
                    <button
                      type="button"
                      disabled={i === 0 || savingId === c.id}
                      onClick={() => move(c.id, -1)}
                      className="text-xs leading-none text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      disabled={i === categories.length - 1 || savingId === c.id}
                      onClick={() => move(c.id, 1)}
                      className="text-xs leading-none text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                    >
                      ▼
                    </button>
                  </div>
                  <input
                    type="text"
                    defaultValue={c.name}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== c.name) {
                        rename(c.id, e.target.value.trim());
                      }
                    }}
                    className="rounded border border-transparent px-2 py-1 text-sm font-medium hover:border-neutral-300 focus:border-neutral-300"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={c.sponsor_id ?? ""}
                    onChange={(e) => assignSponsor(c.id, e.target.value || null)}
                    className="rounded border border-neutral-300 px-2 py-1 text-sm"
                  >
                    <option value="">No sponsor</option>
                    {sponsors.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
