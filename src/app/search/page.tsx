import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Bout } from "@/lib/types";
import SearchBar from "@/components/SearchBar";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: qRaw } = await searchParams;
  const q = (qRaw ?? "").trim();
  const supabase = await createClient();

  let bouts: Bout[] = [];
  let profiles: { username: string; points: number }[] = [];
  let categories: { id: string; name: string }[] = [];

  if (q.length > 0) {
    const like = `%${q}%`;
    const [boutsRes, profilesRes, categoriesRes] = await Promise.all([
      supabase
        .from("bouts")
        .select("*, categories(name)")
        .or(
          `title.ilike.${like},competitor_a_name.ilike.${like},competitor_b_name.ilike.${like}`
        )
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("profiles")
        .select("username, points")
        .ilike("username", like)
        .order("points", { ascending: false })
        .limit(25),
      supabase
        .from("categories")
        .select("id, name")
        .ilike("name", like)
        .limit(10),
    ]);
    bouts = (boutsRes.data as Bout[]) ?? [];
    profiles = profilesRes.data ?? [];
    categories = categoriesRes.data ?? [];
  }

  const noResults =
    q.length > 0 && bouts.length === 0 && profiles.length === 0 && categories.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1
        className="mb-1 text-2xl font-bold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Search
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Find bouts, competitors, categories, and profiles.
      </p>

      <SearchBar initialQuery={q} />

      {q.length === 0 && (
        <p style={{ color: "var(--text-faint)" }}>
          Start typing to search across bouts, categories, and profiles.
        </p>
      )}

      {noResults && (
        <p style={{ color: "var(--text-faint)" }}>
          No results for &ldquo;{q}&rdquo;.
        </p>
      )}

      {categories.length > 0 && (
        <div className="mb-8">
          <h2
            className="mb-2 text-xs font-bold uppercase tracking-wide"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-faint)" }}
          >
            Categories
          </h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <span
                key={c.id}
                className="rounded-full border px-3 py-1.5 text-sm font-semibold"
                style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
              >
                {c.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {profiles.length > 0 && (
        <div className="mb-8">
          <h2
            className="mb-2 text-xs font-bold uppercase tracking-wide"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-faint)" }}
          >
            Profiles
          </h2>
          <div className="bc-card flex flex-col overflow-hidden">
            {profiles.map((p, i) => (
              <Link
                key={p.username}
                href={`/profile/${p.username}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
                style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
              >
                <span className="text-sm font-bold">{p.username}</span>
                <span
                  className="bc-badge-gold rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                >
                  {p.points} pts
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {bouts.length > 0 && (
        <div>
          <h2
            className="mb-2 text-xs font-bold uppercase tracking-wide"
            style={{ fontFamily: "var(--font-display)", color: "var(--text-faint)" }}
          >
            Bouts
          </h2>
          <div className="bc-card flex flex-col overflow-hidden">
            {bouts.map((b, i) => (
              <Link
                key={b.id}
                href={`/bout/${b.id}`}
                className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-2)]"
                style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
              >
                <div className="min-w-0">
                  <div className="text-sm font-bold">
                    {b.competitor_a_name} <span style={{ color: "var(--text-faint)" }}>vs</span>{" "}
                    {b.competitor_b_name}
                  </div>
                  <div className="text-xs" style={{ color: "var(--text-faint)" }}>
                    {b.categories?.name ?? "Uncategorized"}
                  </div>
                </div>
                <span
                  className="flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                  style={{
                    fontFamily: "var(--font-display)",
                    background:
                      b.status === "live"
                        ? "var(--red-soft)"
                        : b.status === "final"
                        ? "var(--gold-soft)"
                        : "var(--surface-2)",
                    color:
                      b.status === "live"
                        ? "var(--red)"
                        : b.status === "final"
                        ? "var(--gold)"
                        : "var(--text-dim)",
                  }}
                >
                  {b.status}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
