"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogoUploadField from "@/components/LogoUploadField";

type Slate = { id: string; title: string };

export default function NewGameForm({ slates, presetSlate }: { slates: Slate[]; presetSlate: string | null }) {
  const router = useRouter();
  const [homeName, setHomeName] = useState("");
  const [homeLogo, setHomeLogo] = useState("");
  const [awayName, setAwayName] = useState("");
  const [awayLogo, setAwayLogo] = useState("");
  const [when, setWhen] = useState("");
  const [allowDraw, setAllowDraw] = useState(false);
  const [slateId, setSlateId] = useState(presetSlate ?? "");
  const [newSlate, setNewSlate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupId, setDupId] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDupId(null);
    if (!when) {
      setError("Choose when the game starts.");
      return;
    }
    setBusy(true);
    const sb = createClient();
    let sid: string | null = slateId || null;
    if (slateId === "__new") {
      if (newSlate.trim().length < 3) {
        setBusy(false);
        setError("Name the weekly slate (at least 3 characters).");
        return;
      }
      const { data, error: sErr } = await sb.rpc("create_pred_slate", { p_title: newSlate, p_week_start: null });
      if (sErr) {
        setBusy(false);
        setError(sErr.message);
        return;
      }
      sid = data as string;
    }
    const { data, error: gErr } = await sb.rpc("create_pred_game", {
      p_home_name: homeName,
      p_home_logo: homeLogo || null,
      p_away_name: awayName,
      p_away_logo: awayLogo || null,
      p_starts_at: new Date(when).toISOString(),
      p_slate_id: sid,
      p_allow_draw: allowDraw,
    });
    setBusy(false);
    if (gErr) {
      setError(gErr.message);
      return;
    }
    const res = data as { ok: boolean; duplicate?: boolean; existing_id?: string; id?: string };
    if (!res.ok && res.duplicate && res.existing_id) {
      setDupId(res.existing_id);
      return;
    }
    router.push(sid ? `/predictions/slate/${sid}` : `/predictions/${res.id}`);
    router.refresh();
  }

  const field = "mt-1 h-11 w-full rounded-xl border bg-transparent px-3 text-sm";
  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      {dupId && (
        <div role="alert" className="rounded-xl border p-4" style={{ borderColor: "var(--red)", background: "var(--surface-2)" }}>
          <p className="font-bold">This Bout is already in progress.</p>
          <p className="mb-2 text-sm" style={{ color: "var(--text-dim)" }}>
            A game with these two teams at about this time already exists, so you can join it instead.
          </p>
          <Link href={`/predictions/${dupId}`} className="text-sm font-bold underline" style={{ color: "var(--blue)" }}>
            Go to the existing game →
          </Link>
        </div>
      )}

      <fieldset className="bc-card p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Home team</legend>
        <label className="block text-xs font-bold">
          Name
          <input value={homeName} onChange={(e) => setHomeName(e.target.value)} required maxLength={40} className={field} style={{ borderColor: "var(--border)" }} placeholder="e.g. Eastside Eagles" />
        </label>
        <div className="mt-3"><LogoUploadField value={homeLogo} onChange={setHomeLogo} folder="teams" /></div>
      </fieldset>

      <fieldset className="bc-card p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Away team</legend>
        <label className="block text-xs font-bold">
          Name
          <input value={awayName} onChange={(e) => setAwayName(e.target.value)} required maxLength={40} className={field} style={{ borderColor: "var(--border)" }} placeholder="e.g. Westview Wolves" />
        </label>
        <div className="mt-3"><LogoUploadField value={awayLogo} onChange={setAwayLogo} folder="teams" /></div>
      </fieldset>

      <div className="bc-card p-4">
        <label className="block text-xs font-bold">
          Game start (your local time). Predictions lock at this moment.
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required className={field} style={{ borderColor: "var(--border)" }} />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={allowDraw} onChange={(e) => setAllowDraw(e.target.checked)} className="h-4 w-4" />
          This sport can end in a tie
        </label>
      </div>

      <div className="bc-card p-4">
        <label className="block text-xs font-bold">
          Weekly slate (optional): group games into one weekly pick&apos;em with its own leaderboard
          <select value={slateId} onChange={(e) => setSlateId(e.target.value)} className={field} style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
            <option value="">Single game (no slate)</option>
            {slates.map((s) => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
            <option value="__new">+ Start a new weekly slate…</option>
          </select>
        </label>
        {slateId === "__new" && (
          <label className="mt-3 block text-xs font-bold">
            Slate name
            <input value={newSlate} onChange={(e) => setNewSlate(e.target.value)} maxLength={80} className={field} style={{ borderColor: "var(--border)" }} placeholder="e.g. Week 7 Friday Night Football" />
          </label>
        )}
      </div>

      {error && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--red)" }}>{error}</p>}
      <button type="submit" disabled={busy} className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60">
        {busy ? "Creating…" : "Create game"}
      </button>
    </form>
  );
}
