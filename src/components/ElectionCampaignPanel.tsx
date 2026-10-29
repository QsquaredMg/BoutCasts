"use client";

import { useCallback, useEffect, useState } from "react";

type Race = { id: string; title: string; options: { id: string; name: string }[] };
type Profile = { slogan: string; platform: string[]; video: string };

type Props = {
  id: string;
  closed: boolean;
  races: Race[];
  requireRegistration: boolean;
  registrationClosesAt: string | null;
  campaignPageEnabled: boolean;
  registered: number;
  total: number;
  onChanged: () => void;
};

// datetime-local wants local time without a zone.
const toLocalInput = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Organizer controls for voter registration and the public campaign page, plus the candidate profile editor.
export default function ElectionCampaignPanel({ id, closed, races, requireRegistration, registrationClosesAt, campaignPageEnabled, registered, total, onChanged }: Props) {
  const [deadline, setDeadline] = useState(toLocalInput(registrationClosesAt));
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const box = { borderColor: "var(--border)", background: "var(--surface)" } as const;

  const loadProfiles = useCallback(async () => {
    const res = await fetch(`/api/school-election/${id}/profiles`, { cache: "no-store" });
    if (!res.ok) return;
    const { profiles: rows, videos = {} } = (await res.json()) as { profiles: { option_id: string; slogan: string | null; platform: string[] }[]; videos?: Record<string, string> };
    setProfiles({
      ...Object.fromEntries(Object.entries(videos).map(([oid, v]) => [oid, { slogan: "", platform: ["", "", ""], video: v }])),
      ...Object.fromEntries(rows.map((r) => [r.option_id, { slogan: r.slogan ?? "", platform: [...r.platform, "", "", ""].slice(0, 3), video: videos[r.option_id] ?? "" }])),
    });
  }, [id]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProfiles();
    setOrigin(window.location.origin);
  }, [loadProfiles]);

  async function setting(body: Record<string, unknown>, label: string) {
    setSaving(label);
    setError(null);
    try {
      const res = await fetch(`/api/school-election/${id}/settings`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Couldn't save.");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(null);
    }
  }

  async function saveProfile(optionId: string) {
    const p = profiles[optionId] ?? { slogan: "", platform: ["", "", ""], video: "" };
    setSaving(optionId);
    setError(null);
    try {
      const res = await fetch(`/api/school-election/${id}/profiles`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ optionId, slogan: p.slogan, platform: p.platform, videoLink: p.video }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Couldn't save.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(null);
    }
  }

  const edit = (optionId: string, fn: (p: Profile) => Profile) =>
    setProfiles((cur) => ({ ...cur, [optionId]: fn(cur[optionId] ?? { slogan: "", platform: ["", "", ""], video: "" }) }));

  return (
    <div className="rounded-xl border p-4" style={box}>
      <p className="font-bold">Registration and campaign pages</p>

      <div className="mt-3 grid gap-2">
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={requireRegistration} disabled={closed || saving !== null} onChange={(e) => setting({ requireRegistration: e.target.checked }, "reg")} className="mt-1" />
          <span><span className="font-semibold">Students must register before they can vote.</span> <span style={{ color: "var(--text-faint)" }}>They register on a page you share, or a teacher registers them at the booth desk. Unregistered students are turned away at the kiosk.</span></span>
        </label>
        {requireRegistration && (
          <div className="ml-6 grid gap-2">
            <p className="text-sm">{registered.toLocaleString()} of {total.toLocaleString()} registered</p>
            <label className="grid gap-1 text-xs font-semibold">
              Self-registration deadline (optional)
              <span className="flex gap-2">
                <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} disabled={closed} className="rounded-[10px] border px-3 py-2 text-sm" style={box} />
                <button onClick={() => setting({ registrationClosesAt: deadline ? new Date(deadline).toISOString() : null }, "deadline")} disabled={closed || saving !== null} className="rounded-full border px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>Save</button>
              </span>
            </label>
            <p className="break-all text-xs">Share this with students: {origin}/school-election/{id}/register</p>
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>Teachers can still register a student at the booth desk after the deadline.</p>
          </div>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={campaignPageEnabled} disabled={closed || saving !== null} onChange={(e) => setting({ campaignPageEnabled: e.target.checked }, "page")} className="mt-1" />
          <span><span className="font-semibold">Show a public campaign page.</span> <span style={{ color: "var(--text-faint)" }}>A page where students and families read each candidate&apos;s slogan and platform before voting. It never shows vote counts.</span></span>
        </label>
        {campaignPageEnabled && <p className="ml-6 break-all text-xs">Campaign page: {origin}/school-election/{id}/campaign</p>}
      </div>

      {!closed && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-bold">Candidate platforms</summary>
          <div className="mt-3 grid gap-4">
            {races.map((r) => (
              <div key={r.id}>
                <p className="text-sm font-bold">{r.title}</p>
                <div className="mt-2 grid gap-3">
                  {r.options.map((o) => {
                    const p = profiles[o.id] ?? { slogan: "", platform: ["", "", ""], video: "" };
                    return (
                      <div key={o.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                        <p className="text-sm font-semibold">{o.name}</p>
                        <input value={p.slogan} maxLength={100} onChange={(e) => edit(o.id, (cur) => ({ ...cur, slogan: e.target.value }))} placeholder="Slogan" className="mt-1.5 w-full rounded-[10px] border px-3 py-2 text-sm" style={box} />
                        {[0, 1, 2].map((i) => (
                          <input key={i} value={p.platform[i] ?? ""} maxLength={140} onChange={(e) => edit(o.id, (cur) => ({ ...cur, platform: cur.platform.map((x, j) => (j === i ? e.target.value : x)) }))} placeholder={`Promise ${i + 1}`} className="mt-1.5 w-full rounded-[10px] border px-3 py-2 text-sm" style={box} />
                        ))}
                        <input value={p.video} onChange={(e) => edit(o.id, (cur) => ({ ...cur, video: e.target.value }))} placeholder="Video link (YouTube, Vimeo, TikTok, Instagram), optional" className="mt-1.5 w-full rounded-[10px] border px-3 py-2 text-sm" style={box} />
                        <button onClick={() => saveProfile(o.id)} disabled={saving !== null} className="mt-2 rounded-full border px-3 py-1.5 text-xs font-bold disabled:opacity-50" style={{ borderColor: "var(--border)" }}>{saving === o.id ? "Saving…" : "Save"}</button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
      {error && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
    </div>
  );
}
