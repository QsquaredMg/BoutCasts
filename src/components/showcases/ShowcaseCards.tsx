import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { KIND_LABEL, type ShowcaseKind } from "@/lib/showcases";

// Server component: a grid of live (then recent) showcases, optionally
// filtered by kind and/or category.
export default async function ShowcaseCards({
  kind,
  categoryId,
  heading,
  limit = 6,
}: {
  kind?: ShowcaseKind;
  categoryId?: string | null;
  heading: string;
  limit?: number;
}) {
  const supabase = await createClient();
  let q = supabase
    .from("showcases")
    .select("id, kind, title, status, closes_at, showcase_choices!showcase_choices_showcase_id_fkey(id, name, image_url)")
    .neq("status", "draft")
    .order("status", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (kind) q = q.eq("kind", kind);
  if (categoryId) q = q.eq("category_id", categoryId);
  const { data } = await q;
  const rows = (data ?? []) as unknown as {
    id: string;
    kind: ShowcaseKind;
    title: string;
    status: "live" | "closed";
    showcase_choices: { id: string; name: string; image_url: string | null }[];
  }[];
  if (rows.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        {heading}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((s) => {
          const live = s.status === "live";
          const pics = s.showcase_choices.slice(0, 5);
          return (
            <Link
              key={s.id}
              href={`/showcase/${s.id}`}
              className="group rounded-xl border p-3.5 hover:border-[var(--red)]"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <p className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: live ? "var(--live)" : "var(--text-faint)" }}>
                {live ? "● Live" : "Final"} · {KIND_LABEL[s.kind].noun} · {s.showcase_choices.length} {KIND_LABEL[s.kind].choice}s
              </p>
              <p className="font-bold leading-snug group-hover:underline" style={{ fontFamily: "var(--font-display)" }}>
                {s.title}
              </p>
              <div className="mt-2 flex -space-x-2">
                {pics.map((c) => (
                  <span
                    key={c.id}
                    title={c.name}
                    className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border-2 text-[11px] font-bold"
                    style={{ borderColor: "var(--surface)", background: "var(--surface-2)", color: "var(--red)" }}
                  >
                    {c.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.image_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (c.name.match(/[a-z0-9]/i)?.[0] ?? "★").toUpperCase()
                    )}
                  </span>
                ))}
                {s.showcase_choices.length > pics.length && (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 text-[10px] font-bold" style={{ borderColor: "var(--surface)", background: "var(--surface-2)", color: "var(--text-dim)" }}>
                    +{s.showcase_choices.length - pics.length}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
