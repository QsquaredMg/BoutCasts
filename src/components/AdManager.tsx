"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Sponsor = { id: string; name: string };

type AdCreative = {
  id: string;
  sponsor_id: string;
  placement: "preroll" | "interstitial" | "banner";
  media_type: "image" | "video";
  media_url: string;
  click_url: string | null;
  headline: string | null;
  status: "active" | "paused" | "ended";
  weight: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

type Stats = { impressions: number; clicks: number };

const EMPTY_FORM = {
  sponsor_id: "",
  placement: "interstitial" as "interstitial" | "banner",
  media_type: "image" as "image" | "video",
  media_url: "",
  click_url: "",
  headline: "",
  weight: 1,
  starts_at: "",
  ends_at: "",
};

const MAX_BYTES = 20 * 1024 * 1024;

export default function AdManager({
  sponsors,
  initialAds,
  statsByAd,
}: {
  sponsors: Sponsor[];
  initialAds: AdCreative[];
  statsByAd: Record<string, Stats>;
}) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [ads, setAds] = useState(initialAds);
  const [form, setForm] = useState({ ...EMPTY_FORM, sponsor_id: sponsors[0]?.id ?? "" });
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function sponsorName(id: string) {
    return sponsors.find((s) => s.id === id)?.name ?? "Unknown sponsor";
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`That file is too large — the limit is 20 MB.`);
      return;
    }
    setError(null);
    setUploading(true);

    const ext = file.name.split(".").pop() || "bin";
    const path = `${form.sponsor_id || "unassigned"}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("ad-creatives").upload(path, file, {
      contentType: file.type,
    });

    setUploading(false);
    if (uploadError) {
      setError(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("ad-creatives").getPublicUrl(path);
    setForm((f) => ({
      ...f,
      media_url: data.publicUrl,
      media_type: file.type.startsWith("video") ? "video" : "image",
    }));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.sponsor_id || !form.media_url.trim()) {
      setError("A sponsor and ad media (upload or URL) are required.");
      return;
    }

    setCreating(true);
    const { data, error } = await supabase
      .from("ad_creatives")
      .insert({
        sponsor_id: form.sponsor_id,
        placement: form.placement,
        media_type: form.media_type,
        media_url: form.media_url.trim(),
        click_url: form.click_url.trim() || null,
        headline: form.headline.trim() || null,
        weight: form.weight,
        starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      })
      .select()
      .single();

    setCreating(false);
    if (error) {
      setError(error.message);
      return;
    }
    setAds((prev) => [data as AdCreative, ...prev]);
    setForm({ ...EMPTY_FORM, sponsor_id: sponsors[0]?.id ?? "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function setStatus(id: string, status: AdCreative["status"]) {
    setError(null);
    setBusyId(id);
    const { error } = await supabase.from("ad_creatives").update({ status }).eq("id", id);
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setAds((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
  }

  async function deleteAd(id: string) {
    setError(null);
    setBusyId(id);
    const { error } = await supabase.from("ad_creatives").delete().eq("id", id);
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setAds((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}

      <section>
        <h3 className="mb-3 text-lg font-semibold">Create an ad</h3>
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex flex-wrap gap-3">
            <select
              value={form.sponsor_id}
              onChange={(e) => setForm((f) => ({ ...f, sponsor_id: e.target.value }))}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              {sponsors.length === 0 && <option value="">No sponsors yet</option>}
              {sponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <select
              value={form.placement}
              onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value as "interstitial" | "banner" }))}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="interstitial">Interstitial (platform-wide, full-screen)</option>
              <option value="banner">Banner (inline, on matchups + bout pages)</option>
            </select>
            <input
              type="number"
              min={1}
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) || 1 }))}
              className="w-24 rounded border border-neutral-300 px-3 py-2 text-sm"
              title="Weight — higher fires more often relative to other active ads in this placement"
            />
          </div>

          <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
                onChange={handleFilePick}
                className="text-xs"
              />
              {uploading && <span className="text-xs text-neutral-500">Uploading...</span>}
            </div>
            <input
              type="url"
              required
              placeholder="Media URL (fills in automatically after upload, or paste one)"
              value={form.media_url}
              onChange={(e) => setForm((f) => ({ ...f, media_url: e.target.value }))}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            />
            {form.media_url && (
              form.media_type === "video" ? (
                <video src={form.media_url} muted className="h-28 w-auto rounded" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.media_url} alt="Ad preview" className="h-28 w-auto rounded" />
              )
            )}
          </div>

          <input
            type="text"
            placeholder="Headline (optional)"
            value={form.headline}
            onChange={(e) => setForm((f) => ({ ...f, headline: e.target.value }))}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          />
          <input
            type="url"
            placeholder="Click-through URL (optional)"
            value={form.click_url}
            onChange={(e) => setForm((f) => ({ ...f, click_url: e.target.value }))}
            className="rounded border border-neutral-300 px-3 py-2 text-sm"
          />

          <div className="flex flex-wrap gap-3">
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              Flight starts (optional)
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                className="rounded border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-neutral-500">
              Flight ends (optional)
              <input
                type="datetime-local"
                value={form.ends_at}
                onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                className="rounded border border-neutral-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={creating || uploading}
            className="self-start rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-60"
          >
            {creating ? "Creating..." : "Create ad"}
          </button>
        </form>
      </section>

      <section>
        <h3 className="mb-3 text-lg font-semibold">All ads</h3>
        {ads.length === 0 ? (
          <p className="text-sm text-neutral-500">No ads yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {ads.map((ad) => {
              const stats = statsByAd[ad.id] ?? { impressions: 0, clicks: 0 };
              const ctr = stats.impressions > 0 ? ((stats.clicks / stats.impressions) * 100).toFixed(1) : "0.0";
              return (
                <div key={ad.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3">
                  {ad.media_type === "video" ? (
                    <video src={ad.media_url} muted className="h-14 w-14 flex-shrink-0 rounded object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ad.media_url} alt="" className="h-14 w-14 flex-shrink-0 rounded object-cover" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{sponsorName(ad.sponsor_id)}</span>
                      <span className="rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-neutral-500">
                        {ad.placement}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          ad.status === "active"
                            ? "bg-green-100 text-green-700"
                            : ad.status === "paused"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {ad.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-neutral-500">
                      {ad.headline ?? "No headline"} &middot; weight {ad.weight}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {stats.impressions} impressions &middot; {stats.clicks} clicks &middot; {ctr}% CTR
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {ad.status !== "active" && (
                      <button
                        onClick={() => setStatus(ad.id, "active")}
                        disabled={busyId === ad.id}
                        className="rounded border border-green-300 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                      >
                        Activate
                      </button>
                    )}
                    {ad.status === "active" && (
                      <button
                        onClick={() => setStatus(ad.id, "paused")}
                        disabled={busyId === ad.id}
                        className="rounded border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-50"
                      >
                        Pause
                      </button>
                    )}
                    <button
                      onClick={() => deleteAd(ad.id)}
                      disabled={busyId === ad.id}
                      className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
