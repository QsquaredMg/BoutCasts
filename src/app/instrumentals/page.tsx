import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Instrumental } from "@/lib/types";

export const metadata: Metadata = {
  title: "Beat Library | BoutCasts",
  description: "Free instrumentals for rap, singing and dance battles. Pick a beat, download it, or record over it in the app.",
};

// Public library of approved instrumentals, with search and a producer filter.
export default async function InstrumentalLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; genre?: string; producer?: string }>;
}) {
  const { q = "", genre = "", producer = "" } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("instrumentals")
    .select("*")
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  const all = (data as Instrumental[] | null) ?? [];

  const needle = q.trim().toLowerCase();
  const items = all.filter(
    (i) =>
      (!needle || `${i.title} ${i.producer_name} ${i.genre ?? ""}`.toLowerCase().includes(needle)) &&
      (!genre || i.genre === genre) &&
      (!producer || i.producer_name === producer)
  );
  const genres = Array.from(new Set(all.map((i) => i.genre).filter(Boolean))) as string[];

  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Beat Library</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
        Every performer in a battle uses the same beat. Download one to perform over, or record over it right in the app.
      </p>

      <form className="mb-6 flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search title, producer or genre"
          className="min-w-0 flex-1 rounded border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
        {genres.length > 0 && (
          <select
            name="genre"
            defaultValue={genre}
            className="rounded border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <option value="">All genres</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        )}
        {producer && <input type="hidden" name="producer" value={producer} />}
        <button type="submit" className="bc-btn-red px-4 py-2 text-sm">Search</button>
      </form>

      {producer && (
        <p className="mb-4 text-sm">
          Showing beats by <strong>{producer}</strong> ·{" "}
          <Link href="/instrumentals" className="underline" style={{ color: "var(--blue)" }}>show all</Link>
        </p>
      )}

      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>No beats found.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((i) => {
            const meta = [i.bpm ? `${i.bpm} BPM` : null, i.musical_key, i.genre].filter(Boolean).join(" · ");
            return (
              <div key={i.id} className="rounded-xl border p-3 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="font-bold">{i.title}</div>
                <div className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>
                  by{" "}
                  <Link href={`/instrumentals?producer=${encodeURIComponent(i.producer_name)}`} className="font-semibold underline">
                    {i.producer_name}
                  </Link>
                  {meta ? ` · ${meta}` : ""}
                </div>
                <audio src={i.file_url} controls preload="none" className="w-full" />
                <a href={i.file_url} download className="mt-2 inline-block text-xs font-semibold underline" style={{ color: "var(--blue)" }}>
                  Download
                </a>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10 rounded-xl border p-4 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
        <p className="mb-2 font-bold">Make beats?</p>
        <p className="mb-3" style={{ color: "var(--text-dim)" }}>
          Submit your instrumentals, get credited on every battle that uses them, then host your own beat battle.
        </p>
        <Link href="/instrumentals/upload" className="mr-4 font-semibold underline" style={{ color: "var(--red)" }}>Submit a beat</Link>
        <Link href="/host" className="font-semibold underline" style={{ color: "var(--red)" }}>Host a beat battle</Link>
      </div>
    </div>
  );
}
