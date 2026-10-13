"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import BracketBuilder from "@/components/BracketBuilder";
import ClipSourceTag from "@/components/ClipSourceTag";
import ShareEventModal from "@/components/ShareEventModal";
import FileUploadPicker from "@/components/FileUploadPicker";
import type { Category } from "@/lib/types";
import { safeHttpUrl } from "@/lib/safeUrl";

// Organizer's control room for one competition: share the entry link,
// approve entries, build brackets, and follow the bouts.

type Entry = {
  id: string;
  title: string;
  category_id: string;
  crew_name: string | null;
  source_type: string;
  source_url: string | null;
  created_at: string;
  status: string;
  profiles: { username: string | null } | null;
};
type BoutRow = {
  id: string;
  title: string;
  status: string;
  bracket_key: string | null;
  round_number: number | null;
  competitor_a_name: string | null;
  competitor_b_name: string | null;
  competitor_a_submission_id: string | null;
  competitor_b_submission_id: string | null;
};

export default function CompetitionManager({ categoryId }: { categoryId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [cat, setCat] = useState<Category | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [bouts, setBouts] = useState<BoutRow[]>([]);
  const [edit, setEdit] = useState({ name: "", description: "", listed: false });
  const [editing, setEditing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [hubColor, setHubColor] = useState<string | null>(null);
  const [hubBanner, setHubBanner] = useState<string | null>(null);
  const [hubSaved, setHubSaved] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      router.push(`/login?next=${encodeURIComponent(`/competitions/${categoryId}`)}`);
      return;
    }
    const { data: c } = await supabase.from("categories").select("*").eq("id", categoryId).maybeSingle();
    if (!c || c.owner_id !== u.user.id) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    setCat(c);
    setEdit({ name: c.name, description: c.description ?? "", listed: c.is_listed });
    setHubColor(c.hub_color ?? null);
    setHubBanner(c.hub_banner_url ?? null);
    const [{ data: subs }, { data: bs }] = await Promise.all([
      supabase
        .from("submissions")
        .select("id, title, category_id, crew_name, source_type, source_url, created_at, status, profiles(username)")
        .eq("category_id", categoryId)
        .order("created_at", { ascending: true }),
      supabase
        .from("bouts")
        .select("id, title, status, bracket_key, round_number, competitor_a_name, competitor_b_name, competitor_a_submission_id, competitor_b_submission_id")
        .eq("category_id", categoryId)
        .order("created_at", { ascending: true }),
    ]);
    setEntries((subs as unknown as Entry[]) ?? []);
    setBouts((bs as BoutRow[]) ?? []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function moderate(id: string, approve: boolean) {
    setBusyId(id);
    setError(null);
    const { error: rpcError } = await supabase.rpc("moderate_submission", {
      p_submission_id: id,
      p_approve: approve,
      p_skip_autopair: true,
    });
    setBusyId(null);
    if (rpcError) setError(rpcError.message);
    load();
  }

  async function saveDetails() {
    setError(null);
    const { error: rpcError } = await supabase.rpc("update_competition", {
      p_id: categoryId,
      p_name: edit.name,
      p_description: edit.description,
      p_listed: edit.listed,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setEditing(false);
    load();
  }

  async function saveHubLook(banner: string | null, color: string | null) {
    setError(null);
    const { error: rpcError } = await supabase.rpc("set_competition_hub_look", {
      p_id: categoryId,
      p_banner_url: banner,
      p_color: color,
    });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    setHubSaved(true);
    setTimeout(() => setHubSaved(false), 2000);
  }

  async function remove() {
    if (!confirm("Delete this competition and all its entries? This can't be undone.")) return;
    const { error: rpcError } = await supabase.rpc("delete_competition", { p_id: categoryId });
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.push("/competitions");
  }

  if (loading) return <p style={{ color: "var(--text-faint)" }}>Loading…</p>;
  if (forbidden || !cat) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Not found
        </h1>
        <p style={{ color: "var(--text-dim)" }}>This competition doesn&apos;t exist or isn&apos;t yours to manage.</p>
      </div>
    );
  }

  const entryUrl = typeof window !== "undefined" ? `${window.location.origin}/submit?category=${cat.id}` : "";
  const usedIds = new Set<string>();
  for (const b of bouts) {
    if (b.competitor_a_submission_id) usedIds.add(b.competitor_a_submission_id);
    if (b.competitor_b_submission_id) usedIds.add(b.competitor_b_submission_id);
  }
  const pending = entries.filter((e) => e.status === "pending" || e.status === "appealed");
  const approved = entries.filter((e) => e.status === "approved");
  const forBuilder = approved.map((e) => ({ ...e, used: usedIds.has(e.id) }));
  const brackets = new Map<string, BoutRow[]>();
  for (const b of bouts) {
    const k = b.bracket_key ?? `single-${b.id}`;
    brackets.set(k, [...(brackets.get(k) ?? []), b]);
  }

  const box = { borderColor: "var(--border)", background: "var(--surface)" };
  const h = "mb-2 text-xs font-bold uppercase tracking-wide";
  const input = "w-full rounded-[10px] border px-3 py-2 text-sm";

  return (
    <div className="flex flex-col gap-5">
      {shareOpen && (
        <ShareEventModal
          url={entryUrl}
          title={cat.name}
          heading="Share your entry link"
          callToAction="Scan to enter"
          onClose={() => setShareOpen(false)}
        />
      )}

      <div>
        <Link href="/competitions" className="text-xs font-semibold" style={{ color: "var(--text-faint)" }}>
          ← My competitions
        </Link>
        {editing ? (
          <div className="mt-2 flex flex-col gap-2">
            <input className={input} style={box} value={edit.name} maxLength={80} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            <textarea className={input} style={{ ...box, minHeight: 70 }} value={edit.description} maxLength={500} onChange={(e) => setEdit({ ...edit, description: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--red)]" checked={edit.listed} onChange={(e) => setEdit({ ...edit, listed: e.target.checked })} />
              Show in public category lists
            </label>
            <div className="flex gap-2">
              <button onClick={saveDetails} className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold">
                Save
              </button>
              <button onClick={() => setEditing(false)} className="rounded-full border px-4 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="mt-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
              {cat.name}
            </h1>
            {cat.description && (
              <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
                {cat.description}
              </p>
            )}
            <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
              {cat.is_listed ? "Public" : "Link-only"} ·{" "}
              <button onClick={() => setEditing(true)} className="underline">
                Edit details
              </button>{" "}
              ·{" "}
              <Link href={`/c/${cat.id}`} className="underline">
                View public hub
              </Link>
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <div className="rounded-xl border p-3.5" style={box}>
        <p className={h} style={{ color: "var(--text-dim)" }}>
          Hub page look {hubSaved && <span style={{ color: "var(--red)" }}>· saved</span>}
        </p>
        <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>
          Your public hub at /c/… shows live matchups, brackets and winners. Add a banner and color
          to make it yours.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="color"
            value={hubColor ?? "#0a0e1a"}
            onChange={(e) => setHubColor(e.target.value)}
            onBlur={() => saveHubLook(hubBanner, hubColor)}
            className="h-10 w-12 cursor-pointer rounded-md border"
            style={{ borderColor: "var(--border)" }}
            aria-label="Hub color"
          />
          {hubBanner ? (
            <div className="flex items-center gap-2 text-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hubBanner} alt="" className="h-10 w-20 rounded border object-cover" style={{ borderColor: "var(--border)" }} />
              <button
                onClick={() => {
                  setHubBanner(null);
                  saveHubLook(null, hubColor);
                }}
                className="underline"
                style={{ color: "var(--text-faint)" }}
              >
                Remove banner
              </button>
            </div>
          ) : (
            <FileUploadPicker
              onUploaded={(url) => {
                setHubBanner(url);
                if (url) saveHubLook(url, hubColor);
              }}
            />
          )}
        </div>
      </div>

      <div className="rounded-xl border p-3.5" style={box}>
        <p className={h} style={{ color: "var(--text-dim)" }}>
          1 · Collect entries
        </p>
        <p className="mb-2 text-sm" style={{ color: "var(--text-dim)" }}>
          Share this link — contestants sign in, upload or link their clip, and it lands here for your approval.
        </p>
        <code className="block truncate rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--border)" }}>
          {entryUrl}
        </code>
        <button onClick={() => setShareOpen(true)} className="bc-btn-solid mt-2.5 w-full rounded-full px-4 py-2.5 text-sm font-bold">
          QR code &amp; share options
        </button>
      </div>

      <div className="rounded-xl border p-3.5" style={box}>
        <p className={h} style={{ color: "var(--text-dim)" }}>
          2 · Approve entries ({pending.length} waiting · {approved.length} approved)
        </p>
        {pending.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            No entries waiting for review.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pending.map((e) => (
              <li key={e.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{e.title}</p>
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                      {e.crew_name ?? e.profiles?.username ?? "Contestant"} · {new Date(e.created_at).toLocaleDateString()}
                      {e.status === "appealed" && " · appealed"}
                    </p>
                  </div>
                  <ClipSourceTag sourceType={e.source_type} sourceUrl={e.source_url} />
                </div>
                {e.source_url && (
                  <a href={safeHttpUrl(e.source_url) ?? undefined} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold underline" style={{ color: "var(--red)" }}>
                    Review clip ↗
                  </a>
                )}
                <div className="mt-2 flex gap-2">
                  <button disabled={busyId === e.id} onClick={() => moderate(e.id, true)} className="bc-btn-solid flex-1 rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-60">
                    Approve
                  </button>
                  <button disabled={busyId === e.id} onClick={() => moderate(e.id, false)} className="flex-1 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-60" style={{ borderColor: "var(--border)" }}>
                    Reject
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border p-3.5" style={box}>
        <p className={h} style={{ color: "var(--text-dim)" }}>
          3 · Build a bracket
        </p>
        {approved.length < 2 ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            Approve at least 2 entries to build a bracket. Brackets use 2, 4, 8, 16… entries.
          </p>
        ) : (
          <BracketBuilder categories={[cat]} submissions={forBuilder as never} />
        )}
      </div>

      <div className="rounded-xl border p-3.5" style={box}>
        <p className={h} style={{ color: "var(--text-dim)" }}>
          Bouts &amp; brackets ({bouts.length})
        </p>
        {bouts.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            Nothing yet — your bracket&apos;s bouts will show here.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {[...brackets.entries()].map(([key, list]) => (
              <div key={key}>
                {list[0].bracket_key ? (
                  <Link href={`/bracket/${list[0].bracket_key}`} className="text-sm font-semibold underline" style={{ color: "var(--red)" }}>
                    Bracket: {list[0].bracket_key} →
                  </Link>
                ) : null}
                <ul className="mt-1 flex flex-col gap-1">
                  {list.map((b) => (
                    <li key={b.id} className="flex justify-between gap-2 text-sm">
                      <Link href={`/bout/${b.id}`} className="truncate hover:underline">
                        {b.round_number ? `R${b.round_number} · ` : ""}
                        {b.competitor_a_name ?? "TBD"} vs {b.competitor_b_name ?? "TBD"}
                      </Link>
                      <span className="text-xs" style={{ color: b.status === "live" ? "var(--live)" : "var(--text-faint)" }}>
                        {b.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      <button onClick={remove} className="self-start text-xs font-semibold underline" style={{ color: "var(--text-faint)" }}>
        Delete competition
      </button>
    </div>
  );
}
