"use client";

import { useEffect, useState } from "react";
import SignInCard from "@/components/SignInCard";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Organizer self-service: create and manage your own bracket competitions
// (e.g. "Jackson High Dance Battle 2026"). Entries come in by link, you
// approve them, then build the bracket.

type Competition = { id: string; name: string; description: string | null; is_listed: boolean; created_at: string };

export default function CompetitionsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [items, setItems] = useState<Competition[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [listed, setListed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      setSignedIn(!!u.user);
      if (!u.user) return;
      const { data } = await supabase
        .from("categories")
        .select("id, name, description, is_listed, created_at")
        .eq("owner_id", u.user.id)
        .order("created_at", { ascending: false });
      setItems(data ?? []);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("create_competition", {
      p_name: name,
      p_description: description,
      p_listed: listed,
    });
    setBusy(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.push(`/competitions/${data}`);
  }

  if (signedIn === false) {
    return (
      <SignInCard
        eyebrow="Competitions"
        title="Run your own bracket"
        body="Sign in to create a competition for your school, league or community — collect entries by link, approve them, and build a bracket the crowd votes on."
        next="/competitions"
      />
    );
  }

  const input = "w-full rounded-[10px] border px-3.5 py-2.5 text-sm";
  const box = { borderColor: "var(--border)", background: "var(--surface)" };

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--red)" }}>
        Competitions
      </p>
      <h1 className="mb-2 text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Run your own bracket
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
        Create a competition, share the entry link, approve the entries you want, and build a
        bracket — the crowd votes each round and winners advance automatically.
      </p>

      <form onSubmit={create} className="mb-8 flex flex-col gap-3 rounded-xl border p-4" style={box}>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
          New competition
        </p>
        <input className={input} style={box} placeholder="e.g. Jackson High Dance Battle 2026" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} />
        <textarea className={input} style={{ ...box, minHeight: 70 }} placeholder="What's it about? Rules, prizes, deadlines (optional)" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} />
        <label className="flex cursor-pointer items-start gap-2.5 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--red)]" checked={listed} onChange={(e) => setListed(e.target.checked)} />
          <span>
            <span className="font-semibold">Show in public category lists</span>
            <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
              Leave off for a school or private group — only people with your entry link can enter.
            </span>
          </span>
        </label>
        <button type="submit" disabled={busy || name.trim().length < 3} className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold disabled:opacity-60">
          {busy ? "Creating…" : "Create competition"}
        </button>
        {error && (
          <p className="text-xs" style={{ color: "var(--danger)" }}>
            {error}
          </p>
        )}
      </form>

      <h2 className="mb-3 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        My competitions
      </h2>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          You haven&apos;t created one yet.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((c) => (
            <Link key={c.id} href={`/competitions/${c.id}`} className="rounded-xl border px-4 py-3 hover:opacity-90" style={box}>
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                {c.is_listed ? "Public" : "Link-only"} · created {new Date(c.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
