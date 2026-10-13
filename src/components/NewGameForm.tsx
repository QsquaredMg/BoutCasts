"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogoUploadField from "@/components/LogoUploadField";
import TeamPicker from "@/components/TeamPicker";
import ZonedDateTimeInput from "@/components/ZonedDateTimeInput";
import { getZone } from "@/lib/time/pref";
import { wallToIso } from "@/lib/time/zones";

export default function NewGameForm({ presetSlate, isAdmin = false }: { presetSlate: string | null; isAdmin?: boolean }) {
  const router = useRouter();
  const [homeName, setHomeName] = useState("");
  const [homeLogo, setHomeLogo] = useState("");
  const [awayName, setAwayName] = useState("");
  const [awayLogo, setAwayLogo] = useState("");
  const [when, setWhen] = useState("");
  const [allowDraw, setAllowDraw] = useState(false);
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
    const sid: string | null = presetSlate;
    const { data, error: gErr } = await sb.rpc("create_pred_game", {
      p_home_name: homeName,
      p_home_logo: homeLogo || null,
      p_away_name: awayName,
      p_away_logo: awayLogo || null,
      p_starts_at: wallToIso(when, getZone()),
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
        <TeamPicker onPick={(t) => { setHomeName(t.name); setHomeLogo(t.logo); }} />
        <label className="block text-xs font-bold">
          Name
          <input value={homeName} onChange={(e) => setHomeName(e.target.value)} required maxLength={40} className={field} style={{ borderColor: "var(--border)" }} placeholder="e.g. Eastside Eagles" />
        </label>
        <div className="mt-3"><LogoUploadField value={homeLogo} onChange={setHomeLogo} folder="teams" /></div>
      </fieldset>

      <fieldset className="bc-card p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Away team</legend>
        <TeamPicker onPick={(t) => { setAwayName(t.name); setAwayLogo(t.logo); }} />
        <label className="block text-xs font-bold">
          Name
          <input value={awayName} onChange={(e) => setAwayName(e.target.value)} required maxLength={40} className={field} style={{ borderColor: "var(--border)" }} placeholder="e.g. Westview Wolves" />
        </label>
        <div className="mt-3"><LogoUploadField value={awayLogo} onChange={setAwayLogo} folder="teams" /></div>
      </fieldset>

      <div className="bc-card p-4">
        <label className="block text-xs font-bold">
          Game start (your local time). Predictions stay open for 15 minutes after this time.{!presetSlate && !isAdmin && " A free single game must start within 24 hours."}
          <ZonedDateTimeInput value={when} onChange={setWhen} required className={field} style={{ borderColor: "var(--border)" }} />
        </label>
        <label className="mt-3 flex items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={allowDraw} onChange={(e) => setAllowDraw(e.target.checked)} className="h-4 w-4" />
          This sport can end in a tie
        </label>
      </div>

      {error && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--red)" }}>{error}</p>}
      <button type="submit" disabled={busy} className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60">
        {busy ? "Creating…" : "Create game"}
      </button>
    </form>
  );
}
