import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import NewPackButton from "@/components/trivia/NewPackButton";

export const metadata: Metadata = { title: "Trivia question packs", robots: { index: false } };

export default async function PacksPage() {
  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user)
    return (
      <div className="mx-auto max-w-2xl px-5 py-10">
        <p><Link href="/login?next=/trivia/packs" className="font-semibold underline">Sign in</Link> to build question packs and host trivia.</p>
      </div>
    );
  const { data: packs } = await supabase
    .from("trivia_packs")
    .select("id, title, status, source, created_at, trivia_questions(count)")
    .eq("owner_id", u.user.id)
    .order("created_at", { ascending: false });

  const badge = (s: string) => (s === "approved" ? ["Ready to host", "#16a34a"] : ["Needs review", "#b45309"]);
  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Your question packs</h1>
        <NewPackButton />
      </div>
      <ul className="space-y-2">
        {(packs ?? []).map((p) => {
          const [label, color] = badge(p.status);
          const n = (p.trivia_questions as unknown as { count: number }[])?.[0]?.count ?? 0;
          return (
            <li key={p.id}>
              <Link href={`/trivia/packs/${p.id}`} className="flex items-center justify-between rounded-xl border p-4">
                <span>
                  <b>{p.title}</b>
                  <span className="block text-xs" style={{ color: "var(--text-faint)" }}>{n} questions{p.source === "ai" ? " · AI draft" : ""}</span>
                </span>
                <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: color }}>{label}</span>
              </Link>
            </li>
          );
        })}
        {(packs ?? []).length === 0 && <li className="text-sm" style={{ color: "var(--text-faint)" }}>No packs yet. Start one above.</li>}
      </ul>
    </div>
  );
}
