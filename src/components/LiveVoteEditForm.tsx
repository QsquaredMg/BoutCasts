"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ImageField from "@/components/ImageField";

type Opt = { key: string; id?: string; name: string; description: string; imageUrl: string | null; teamName: string };

const inputClass = "w-full rounded-[10px] border px-3.5 py-2.5 text-sm";
const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };
const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide";
const labelStyle = { color: "var(--text-dim)" };

export default function LiveVoteEditForm({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"draft" | "live" | "closed">("draft");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [opts, setOpts] = useState<Opt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let off = false;
    fetch(`/api/live-vote/${eventId}/edit`)
      .then(async (r) => {
        const d = await r.json();
        if (off) return;
        if (!r.ok) return setError(d.error ?? "Could not load this vote.");
        setStatus(d.event.status);
        setTitle(d.event.title ?? "");
        setDescription(d.event.description ?? "");
        setCover(d.event.cover_image_url ?? null);
        setOpts(
          (d.options as { id: string; name: string; description: string | null; image_url: string | null; team_name: string | null }[]).map((o) => ({
            key: o.id, id: o.id, name: o.name, description: o.description ?? "", imageUrl: o.image_url, teamName: o.team_name ?? "",
          }))
        );
        setLoaded(true);
      })
      .catch(() => !off && setError("Could not load this vote."));
    return () => { off = true; };
  }, [eventId]);

  const draft = status === "draft";
  const closed = status === "closed";
  const update = (key: string, patch: Partial<Opt>) => setOpts((p) => p.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  const move = (i: number, d: number) =>
    setOpts((p) => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n; });

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/live-vote/${eventId}/edit`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title, description, coverImageUrl: cover,
        options: opts.map((o) => ({ id: o.id, name: o.name, description: o.description, imageUrl: o.imageUrl, teamName: o.teamName })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(d.error ?? "Could not save.");
    router.push(`/live-vote/${eventId}`);
    router.refresh();
  }

  if (!loaded) {
    return <p className="text-sm" style={{ color: "var(--text-dim)" }}>{error ?? "Loading…"}</p>;
  }

  return (
    <div>
      <Link href={`/live-vote/${eventId}`} className="text-sm font-semibold underline">← Back to the vote</Link>
      <h1 className="mb-2 mt-3 text-3xl font-extrabold">Edit this vote</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-dim)" }}>
        {closed
          ? "Voting has closed, so this can no longer be edited."
          : draft
            ? "Voting hasn't opened, so you can change anything here, including adding, removing and reordering options."
            : "Voting is open. You can fix the title, wording and photos, but options can't be added, removed or reordered. Videos and clips are edited from the vote's page."}
      </p>

      <fieldset disabled={closed || saving} className="flex flex-col gap-5">
        <div>
          <label className={labelClass} style={labelStyle}>Title</label>
          <input className={inputClass} style={inputStyle} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Description</label>
          <textarea className={inputClass} style={inputStyle} rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={labelClass} style={labelStyle}>Cover photo</label>
          <ImageField value={cover} onChange={setCover} label="cover photo" wide />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>Options</label>
          <div className="flex flex-col gap-3">
            {opts.map((o, i) => (
              <div key={o.key} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <span className="text-xs font-bold" style={{ color: "var(--text-dim)" }}>Option {i + 1}</span>
                  {draft && (
                    <span className="flex gap-1 text-xs font-bold">
                      <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded border px-2 py-0.5" style={{ borderColor: "var(--border)" }}>↑</button>
                      <button type="button" onClick={() => move(i, 1)} disabled={i === opts.length - 1} className="rounded border px-2 py-0.5" style={{ borderColor: "var(--border)" }}>↓</button>
                      <button type="button" onClick={() => setOpts((p) => p.filter((x) => x.key !== o.key))} disabled={opts.length <= 2} className="rounded border px-2 py-0.5" style={{ borderColor: "var(--border)" }}>Remove</button>
                    </span>
                  )}
                </div>
                <input className={inputClass} style={inputStyle} placeholder="Name" maxLength={100} value={o.name} onChange={(e) => update(o.key, { name: e.target.value })} />
                <input className={`${inputClass} mt-2`} style={inputStyle} placeholder="Team (optional)" value={o.teamName} onChange={(e) => update(o.key, { teamName: e.target.value })} />
                <textarea className={`${inputClass} mt-2`} style={inputStyle} rows={2} maxLength={500} placeholder="Short description (optional)" value={o.description} onChange={(e) => update(o.key, { description: e.target.value })} />
                <div className="mt-2">
                  <ImageField value={o.imageUrl} onChange={(u) => update(o.key, { imageUrl: u })} label="photo" />
                </div>
              </div>
            ))}
          </div>
          {draft && opts.length < 64 && (
            <button type="button" className="mt-3 rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}
              onClick={() => setOpts((p) => [...p, { key: `new-${Date.now()}-${p.length}`, name: "", description: "", imageUrl: null, teamName: "" }])}>
              + Add an option
            </button>
          )}
        </div>
      </fieldset>

      {error && <p className="mt-4 text-sm font-semibold" style={{ color: "var(--live)" }}>{error}</p>}
      {!closed && (
        <div className="mt-6 flex gap-3">
          <button onClick={save} disabled={saving} className="bc-btn-solid rounded-full px-6 py-2.5 text-sm font-bold">{saving ? "Saving…" : "Save changes"}</button>
          <Link href={`/live-vote/${eventId}`} className="rounded-full border px-5 py-2.5 text-sm font-bold" style={{ borderColor: "var(--border)" }}>Cancel</Link>
        </div>
      )}
    </div>
  );
}
