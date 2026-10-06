"use client";

import { useRef, useState } from "react";
import { prepareImage, isPhotoFile, UnsupportedPhotoError } from "@/lib/prepareImage";
import { createClient } from "@/lib/supabase/client";
import EmbeddedClipPlayer from "@/components/EmbeddedClipPlayer";
import { normalizeEmbedInput } from "@/lib/clipSource";

type Sponsor = { id: string; name: string };

type AdCreative = {
  id: string;
  sponsor_id: string;
  placement: "preroll" | "interstitial" | "banner" | "live_vote";
  media_type: "image" | "video" | "embed";
  media_url: string;
  click_url: string | null;
  headline: string | null;
  status: "active" | "paused" | "ended" | "pending" | "rejected";
  weight: number;
  max_impressions: number | null;
  impressions_served: number;
  submitted_by: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

type Stats = { impressions: number; clicks: number };

const EMPTY_FORM = {
  sponsor_id: "",
  placement: "interstitial" as "preroll" | "interstitial" | "banner" | "live_vote",
  media_type: "image" as "image" | "video" | "embed",
  media_url: "",
  click_url: "",
  headline: "",
  weight: 1,
  max_impressions: "",
  starts_at: "",
  ends_at: "",
};

const MAX_BYTES = 75 * 1024 * 1024; // matches the ad-creatives bucket limit

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
  const [source, setSource] = useState<"upload" | "link" | "embed">("upload");
  const [embedInput, setEmbedInput] = useState("");

  function sponsorName(id: string) {
    return sponsors.find((s) => s.id === id)?.name ?? "Unknown sponsor";
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    let file = picked;
    if (!picked.type.startsWith("video/") && isPhotoFile(picked)) {
      try {
        file = await prepareImage(picked);
      } catch (err) {
        setError(err instanceof UnsupportedPhotoError ? err.message : "We couldn't read that image.");
        return;
      }
    }
    if (file.size > MAX_BYTES) {
      setError(`That file is too large — the limit is 75 MB.`);
      return;
    }
    setError(null);
    setUploading(true);

    const ext = file.type.startsWith("image/") ? (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg") : file.name.split(".").pop() || "bin";
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
        max_impressions: form.max_impressions ? Math.max(1, Math.floor(Number(form.max_impressions))) : null,
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

  // Raise, lower or clear the delivery target (a make-good is just a higher cap).
  async function setCap(id: string, raw: string) {
    setError(null);
    const trimmed = raw.trim();
    const value = trimmed === "" ? null : Math.floor(Number(trimmed));
    if (value !== null && (!Number.isFinite(value) || value < 1)) {
      setError("An impression cap must be a whole number of 1 or more, or blank for no cap.");
      return;
    }
    setBusyId(id);
    const { error } = await supabase.from("ad_creatives").update({ max_impressions: value }).eq("id", id);
    setBusyId(null);
    if (error) {
      setError(error.message);
      return;
    }
    setAds((prev) => prev.map((a) => (a.id === id ? { ...a, max_impressions: value } : a)));
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
              onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value as "preroll" | "interstitial" | "banner" | "live_vote" }))}
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
            >
              <option value="interstitial">Interstitial (platform-wide, full-screen)</option>
              <option value="banner">Banner (inline, on matchups + bout pages)</option>
              <option value="preroll" disabled={form.media_type === "embed"}>
                Pre-roll (before an uploaded/recorded clip plays){form.media_type === "embed" ? " — not for embeds" : ""}
              </option>
              <option value="live_vote">Live Vote (on the public ballot page, admin-enabled per event)</option>
            </select>
            <input
              type="number"
              min={1}
              value={form.weight}
              onChange={(e) => setForm((f) => ({ ...f, weight: Number(e.target.value) || 1 }))}
              className="w-24 rounded border border-neutral-300 px-3 py-2 text-sm"
              title="Weight — higher fires more often relative to other active ads in this placement"
            />
            <input
              type="number"
              min={1}
              placeholder="Impression cap"
              value={form.max_impressions}
              onChange={(e) => setForm((f) => ({ ...f, max_impressions: e.target.value }))}
              className="w-36 rounded border border-neutral-300 px-3 py-2 text-sm"
              title="Delivery target — the ad stops serving once it reaches this many impressions. Leave blank for no cap."
            />
          </div>

          <div className="flex flex-col gap-2 rounded border border-neutral-200 p-3">
            <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
              {(
                [
                  ["upload", "Upload image / video"],
                  ["link", "Image / video link"],
                  ["embed", "Embed (YouTube, Vimeo, TikTok, Spotify…)"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSource(key);
                    setEmbedInput("");
                    setForm((f) => ({
                      ...f,
                      media_url: "",
                      media_type: key === "embed" ? "embed" : "image",
                      placement: key === "embed" && f.placement === "preroll" ? "banner" : f.placement,
                    }));
                  }}
                  className={`rounded-full border px-3 py-1 ${source === key ? "border-red-600 text-red-600" : "border-neutral-300 text-neutral-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {source === "upload" && (
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,.heic,.heif,.avif,.bmp,.tif,.tiff,.svg,video/mp4,video/webm"
                  onChange={handleFilePick}
                  className="text-xs"
                />
                {uploading && <span className="text-xs text-neutral-500">Uploading...</span>}
              </div>
            )}

            {source === "link" && (
              <div className="flex flex-wrap gap-2">
                <input
                  type="url"
                  placeholder="https://… (.jpg, .png, .gif, .mp4, .webm)"
                  value={form.media_url}
                  onChange={(e) => {
                    const v = e.target.value;
                    setForm((f) => ({ ...f, media_url: v, media_type: /\.(mp4|webm|mov)(\?|$)/i.test(v) ? "video" : "image" }));
                  }}
                  className="flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
                />
              </div>
            )}

            {source === "embed" && (
              <>
                <textarea
                  placeholder="Paste a YouTube / Vimeo / TikTok / Spotify / SoundCloud link, or their embed code"
                  value={embedInput}
                  onChange={(e) => {
                    const v = e.target.value;
                    setEmbedInput(v);
                    const url = normalizeEmbedInput(v);
                    setForm((f) => ({ ...f, media_url: url ?? "", media_type: "embed" }));
                  }}
                  className="min-h-[70px] rounded border border-neutral-300 px-3 py-2 text-sm"
                />
                {embedInput && !form.media_url && (
                  <p className="text-xs text-red-600">
                    We couldn&apos;t find an embeddable video in that. Paste the share link or the embed code
                    from YouTube, Vimeo, TikTok, Spotify or SoundCloud.
                  </p>
                )}
                <p className="text-[11px] text-neutral-500">
                  Only the video address is saved — pasted scripts are never run. Embeds can&apos;t be pre-rolls.
                </p>
              </>
            )}

            {form.media_url && (
              form.media_type === "embed" ? (
                <div className="max-w-sm">
                  <EmbeddedClipPlayer sourceUrl={form.media_url} label="Ad preview" />
                </div>
              ) : form.media_type === "video" ? (
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
                  {ad.media_type === "embed" ? (
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded bg-neutral-900 text-center text-[10px] font-bold text-white" title={ad.media_url}>
                      ▶ Embed
                    </div>
                  ) : ad.media_type === "video" ? (
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
                            : ad.status === "paused" || ad.status === "pending"
                            ? "bg-amber-100 text-amber-700"
                            : ad.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-neutral-100 text-neutral-500"
                        }`}
                      >
                        {ad.status === "pending" ? "needs review" : ad.status}
                      </span>
                    </div>
                    <p className="mt-1 truncate text-xs text-neutral-500">
                      {ad.headline ?? "No headline"} &middot; weight {ad.weight}
                    </p>
                    <p className="mt-0.5 text-xs text-neutral-400">
                      {stats.impressions} impressions &middot; {stats.clicks} clicks &middot; {ctr}% CTR
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      {ad.max_impressions ? (
                        <span>
                          Delivered {ad.impressions_served.toLocaleString()} of {ad.max_impressions.toLocaleString()}
                          {ad.impressions_served >= ad.max_impressions ? " — cap reached, not serving" : ""}
                        </span>
                      ) : (
                        <span>No impression cap</span>
                      )}
                      <label className="flex items-center gap-1">
                        Cap
                        <input
                          key={`${ad.id}-${ad.max_impressions ?? "none"}`}
                          type="number"
                          min={1}
                          defaultValue={ad.max_impressions ?? ""}
                          placeholder="none"
                          onBlur={(e) => {
                            const next = e.target.value.trim();
                            if (next !== String(ad.max_impressions ?? "")) setCap(ad.id, next);
                          }}
                          className="w-24 rounded border border-neutral-300 px-2 py-1 text-xs"
                        />
                      </label>
                    </p>
                    {ad.status === "pending" && (
                      <p className="mt-0.5 text-xs text-amber-700">
                        Submitted by the sponsor. Set a weight and cap if needed, then approve to start serving.
                      </p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-2">
                    {ad.status !== "active" && (
                      <button
                        onClick={() => setStatus(ad.id, "active")}
                        disabled={busyId === ad.id}
                        className="rounded border border-green-300 px-3 py-1.5 text-xs font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50"
                      >
                        {ad.status === "pending" ? "Approve" : "Activate"}
                      </button>
                    )}
                    {ad.status === "pending" && (
                      <button
                        onClick={() => setStatus(ad.id, "rejected")}
                        disabled={busyId === ad.id}
                        className="rounded border border-neutral-300 px-3 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
                      >
                        Reject
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
