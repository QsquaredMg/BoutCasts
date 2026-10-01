"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Instrumental } from "@/lib/types";

// Lets a staff member or organizer pick an approved instrumental for a bout.
// Renders nothing useful until the instrumentals table exists, and degrades to
// "No instrumentals yet" if the query fails.
export default function InstrumentalPicker({
  value,
  onChange,
  disabled = false,
  onSelect,
  label = "Instrumental (both performers use the same track)",
}: {
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  /** Called with the selected track (or null) whenever the selection or list changes. */
  onSelect?: (item: Instrumental | null) => void;
  label?: string;
}) {
  const supabase = createClient();
  const [items, setItems] = useState<Instrumental[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("instrumentals")
      .select("*")
      .eq("status", "approved")
      .order("title")
      .then(({ data }) => {
        if (!cancelled) setItems((data as Instrumental[] | null) ?? []);
      });
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  useEffect(() => {
    if (!onSelect || items === null) return;
    onSelect(items.find((i) => i.id === value) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, value]);

  return (
    <div className="flex-1">
      <label className="mb-1 block text-xs font-semibold text-neutral-600">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60"
      >
        <option value="">None</option>
        {(items ?? []).map((i) => (
          <option key={i.id} value={i.id}>
            {i.title} — {i.producer_name}
            {i.bpm ? ` (${i.bpm} BPM)` : ""}
          </option>
        ))}
      </select>
      {items !== null && items.length === 0 && (
        <p className="mt-1 text-xs text-neutral-500">No approved instrumentals yet.</p>
      )}
    </div>
  );
}
