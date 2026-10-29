"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ImageField from "@/components/ImageField";
import ClipSourcePicker, { type ClipSourceValue } from "@/components/ClipSourcePicker";
import EventBrandingEditor from "@/components/EventBrandingEditor";
import EventVenuePanel from "@/components/EventVenuePanel";
import LiveVoteOptionMediaManager from "@/components/LiveVoteOptionMediaManager";
import { createClient } from "@/lib/supabase/client";
import { parseClock } from "@/lib/showcases";
import { formatDuration } from "@/lib/mediaDuration";

type Opt = { key: string; id?: string; name: string; description: string; imageUrl: string | null; teamName: string; start: string };

const inputClass = "w-full rounded-[10px] border px-3.5 py-2.5 text-sm";
const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };
const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide";
const labelStyle = { color: "var(--text-dim)" };

export default function LiveVoteEditForm({ eventId }: { eventId: string }) {
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<"draft" | "live" | "closed">("draft");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [opts, setOpts] = useState<Opt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [voterMode, setVoterMode] = useState<"account" | "open_link">("account");
  const [votingMethod, setVotingMethod] = useState<"single" | "ranked">("single");
  const [scoringMode, setScoringMode] = useState<"crowd" | "judges">("crowd");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [criteria, setCriteria] = useState<string[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [cats, setCats] = useState<{ id: string; name: string }[]>([]);
  const [subs, setSubs] = useState<{ id: string; name: string; category_id: string }[]>([]);
  const [sharedVideo, setSharedVideo] = useState(false);
  const [sharedClip, setSharedClip] = useState<ClipSourceValue>({ sourceType: "link", sourceUrl: "" });
  const [isFree, setIsFree] = useState(true);
  const [isPrivate, setIsPrivate] = useState(true);

  const load = useCallback(async () => {
    const r = await fetch(`/api/live-vote/${eventId}/edit`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setError(d.error ?? "Could not load this vote.");
    const ev = d.event;
    setStatus(ev.status);
    setTitle(ev.title ?? "");
    setDescription(ev.description ?? "");
    setCover(ev.cover_image_url ?? null);
    setVoterMode(ev.voter_mode === "open_link" ? "open_link" : "account");
    setVotingMethod(ev.voting_method === "ranked" ? "ranked" : "single");
    setScoringMode(ev.scoring_mode === "judges" ? "judges" : "crowd");
    setVisibility(ev.is_private ? "private" : "public");
    setIsPrivate(!!ev.is_private);
    setIsFree(ev.tier === "free");
    setCategoryId(ev.category_id ?? "");
    setSubcategoryId(ev.subcategory_id ?? "");
    setCriteria(d.criteria ?? []);
    setSharedVideo(!!ev.shared_source_url);
    setSharedClip({ sourceType: ev.shared_source_type ?? "link", sourceUrl: ev.shared_source_url ?? "" });
    setOpts(
      (d.options as { id: string; name: string; description: string | null; image_url: string | null; team_name: string | null; start_seconds: number | null }[]).map((o) => ({
        key: o.id, id: o.id, name: o.name, description: o.description ?? "", imageUrl: o.image_url, teamName: o.team_name ?? "",
        start: o.start_seconds != null ? formatDuration(o.start_seconds) : "",
      }))
    );
    setLoaded(true);
  }, [eventId]);

  useEffect(() => {
    Promise.resolve().then(load).catch(() => setError("Could not load this vote."));
    const sb = createClient();
    sb.from("categories").select("id, name").eq("is_listed", true).is("owner_id", null).order("sort_order").then(({ data }) => setCats(data ?? []));
    sb.from("subcategories").select("id, name, category_id").order("sort_order").then(({ data }) => setSubs(data ?? []));
  }, [load]);

  const draft = status === "draft";
  const closed = status === "closed";
  const update = (key: string, patch: Partial<Opt>) => setOpts((p) => p.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  const move = (i: number, d: number) =>
    setOpts((p) => { const n = [...p]; const j = i + d; if (j < 0 || j >= n.length) return p; [n[i], n[j]] = [n[j], n[i]]; return n; });

  async function save() {
    setError(null);
    setSaved(false);
    if (sharedVideo) {
      for (const o of opts) {
        if (Number.isNaN(parseClock(o.start))) return setError(`"${o.name || "An option"}": the start time should look like 4:15 or 1:02:30.`);
      }
    }
    setSaving(true);
    const res = await fetch(`/api/live-vote/${eventId}/edit`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title, description, coverImageUrl: cover, categoryId: categoryId || null, subcategoryId: subcategoryId || null,
        voterMode, votingMethod, scoringMode, visibility, criteria,
        sharedVideo: sharedVideo && sharedClip.sourceUrl?.trim() ? { sourceType: sharedClip.sourceType, sourceUrl: sharedClip.sourceUrl } : null,
        options: opts.map((o) => ({
          id: o.id, name: o.name, description: o.description, imageUrl: o.imageUrl, teamName: o.teamName,
          startSeconds: sharedVideo ? parseClock(o.start) : null,
        })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(d.error ?? "Could not save.");
    setSaved(true);
    await load();
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
          <label className={labelClass} style={labelStyle}>Category (optional)</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select className={inputClass} style={inputStyle} value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(""); }}>
              <option value="">No category</option>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            {subs.some((sc) => sc.category_id === categoryId) && (
              <select className={inputClass} style={inputStyle} value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)} aria-label="Subcategory">
                <option value="">Any subcategory</option>
                {subs.filter((sc) => sc.category_id === categoryId).map((sc) => <option key={sc.id} value={sc.id}>{sc.name}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <p className="mb-1 text-sm font-bold">Voting rules {!draft && <span className="text-xs font-normal" style={{ color: "var(--text-faint)" }}>(locked once voting opens)</span>}</p>
          <fieldset disabled={!draft} className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold" style={labelStyle}>Who is scoring
              <select className={`${inputClass} mt-1`} style={inputStyle} value={scoringMode} onChange={(e) => setScoringMode(e.target.value as "crowd" | "judges")}>
                <option value="crowd">The crowd votes</option>
                <option value="judges">A judges panel scores</option>
              </select>
            </label>
            {scoringMode === "crowd" && (
              <label className="text-xs font-bold" style={labelStyle}>Voting method
                <select className={`${inputClass} mt-1`} style={inputStyle} value={votingMethod} onChange={(e) => setVotingMethod(e.target.value as "single" | "ranked")}>
                  <option value="single">One pick</option>
                  <option value="ranked">Ranked choice</option>
                </select>
              </label>
            )}
            <label className="text-xs font-bold" style={labelStyle}>Who can vote
              <select className={`${inputClass} mt-1`} style={inputStyle} value={voterMode} onChange={(e) => setVoterMode(e.target.value as "account" | "open_link")}>
                <option value="account">Signed-in accounts (one per person)</option>
                <option value="open_link">Anyone with the link (one per browser)</option>
              </select>
            </label>
            <label className="text-xs font-bold" style={labelStyle}>Visibility
              <select className={`${inputClass} mt-1`} style={inputStyle} value={visibility} onChange={(e) => setVisibility(e.target.value as "private" | "public")}>
                <option value="private">Private (link, code or QR only)</option>
                <option value="public">Public (listed on Explore)</option>
              </select>
            </label>
          </fieldset>
          {scoringMode === "judges" && (
            <fieldset disabled={!draft} className="mt-3">
              <p className="mb-1 text-xs font-bold" style={labelStyle}>Scoring criteria</p>
              {criteria.map((c, i) => (
                <div key={i} className="mb-2 flex gap-2">
                  <input className={inputClass} style={inputStyle} value={c} placeholder="e.g. Creativity" onChange={(e) => setCriteria((p) => p.map((x, j) => (j === i ? e.target.value : x)))} />
                  <button type="button" className="rounded border px-3 text-xs font-bold" style={{ borderColor: "var(--border)" }} onClick={() => setCriteria((p) => p.filter((_, j) => j !== i))}>Remove</button>
                </div>
              ))}
              <button type="button" className="text-xs font-bold underline" onClick={() => setCriteria((p) => [...p, ""])}>+ Add criterion</button>
            </fieldset>
          )}
        </div>

        <div className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <label className="flex cursor-pointer items-start gap-2.5 text-sm">
            <input type="checkbox" className="mt-0.5 h-4 w-4" checked={sharedVideo} disabled={!draft} onChange={(e) => setSharedVideo(e.target.checked)} />
            <span>
              <b>One video for all options</b>
              <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                Voters watch one video, then pick. Give each option a start time so voters can jump to it.{!draft && " The link can be fixed, but this can't be switched on or off after voting opens."}
              </span>
            </span>
          </label>
          {sharedVideo && (
            <div className="mt-3">
              <ClipSourcePicker value={sharedClip} onChange={setSharedClip} inputClass={inputClass} inputStyle={inputStyle} />
            </div>
          )}
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
                {sharedVideo && (
                  <input className={`${inputClass} mt-2`} style={inputStyle} placeholder="Start time in the video, e.g. 4:15" value={o.start} onChange={(e) => update(o.key, { start: e.target.value })} />
                )}
                <textarea className={`${inputClass} mt-2`} style={inputStyle} rows={2} maxLength={500} placeholder="Short description (optional)" value={o.description} onChange={(e) => update(o.key, { description: e.target.value })} />
                <div className="mt-2">
                  <ImageField value={o.imageUrl} onChange={(u) => update(o.key, { imageUrl: u })} label="photo" />
                </div>
              </div>
            ))}
          </div>
          {draft && opts.length < 64 && (
            <button type="button" className="mt-3 rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}
              onClick={() => setOpts((p) => [...p, { key: `new-${Date.now()}-${p.length}`, name: "", description: "", imageUrl: null, teamName: "", start: "" }])}>
              + Add an option
            </button>
          )}
        </div>
      </fieldset>

      {error && <p className="mt-4 text-sm font-semibold" style={{ color: "var(--live)" }}>{error}</p>}
      {saved && <p className="mt-4 text-sm font-semibold" style={{ color: "var(--live)" }}>Saved.</p>}
      {!closed && (
        <div className="mt-6 flex gap-3">
          <button onClick={save} disabled={saving} className="bc-btn-solid rounded-full px-6 py-2.5 text-sm font-bold">{saving ? "Saving…" : "Save changes"}</button>
          <Link href={`/live-vote/${eventId}`} className="rounded-full border px-5 py-2.5 text-sm font-bold" style={{ borderColor: "var(--border)" }}>Done</Link>
        </div>
      )}

      <h2 className="mb-1 mt-10 text-xl font-extrabold">Look, videos and place</h2>
      <p className="mb-4 text-sm" style={{ color: "var(--text-dim)" }}>These save on their own with their own buttons.</p>
      <EventBrandingEditor eventId={eventId} isFree={isFree} isPrivate={isPrivate} editable={!closed} />
      {!sharedVideo && <LiveVoteOptionMediaManager eventId={eventId} status={status} onChanged={load} />}
      <EventVenuePanel eventId={eventId} />
    </div>
  );
}
