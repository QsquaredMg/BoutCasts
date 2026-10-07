import type { SupabaseClient } from "@supabase/supabase-js";
import type { Range } from "./range";

export type Daily = { day: string };

export async function loadSection<T>(
  supabase: SupabaseClient,
  fn: "overview" | "ads" | "traffic" | "engagement" | "growth" | "health",
  from: Date,
  to: Date,
): Promise<T | null> {
  const { data, error } = await supabase.rpc(`admin_analytics_${fn}`, {
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  });
  if (error) return null;
  return data as T;
}

export async function loadCurrentAndPrev<T>(
  supabase: SupabaseClient,
  fn: "overview" | "ads" | "traffic" | "engagement" | "growth" | "health",
  r: Range,
): Promise<{ cur: T | null; prev: T | null }> {
  const [cur, prev] = await Promise.all([
    loadSection<T>(supabase, fn, r.from, r.to),
    r.compare ? loadSection<T>(supabase, fn, r.prevFrom, r.prevTo) : Promise.resolve(null),
  ]);
  return { cur, prev };
}

export const n = (v: number | null | undefined) => (v ?? 0).toLocaleString();
export const pct = (num: number, den: number) => (den > 0 ? `${((num / den) * 100).toFixed(1)}%` : "-");
export const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
