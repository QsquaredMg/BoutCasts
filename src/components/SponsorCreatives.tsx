"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { prepareImage, isPhotoFile, UnsupportedPhotoError } from "@/lib/prepareImage";

type Placement = "interstitial" | "banner" | "preroll";

type Creative = {
  id: string;
  sponsor_id: string;
  placement: string;
  media_type: "image" | "video" | "embed";
  media_url: string;
  click_url: string | null;
  headline: string | null;
  status: "active" | "paused" | "ended" | "pending" | "rejected";
  max_impressions: number | null;
  impressions_served: number;
  review_note: string | null;
};

type Stat = { ad_id: string; impressions: number; clicks: number };

const MAX_BYTES = 105 * 1024 * 1024; // matches the ad-creatives bucket limit

const PLACEMENTS: { key: Placement; label: string; hint: string }[] = [
  { key: "banner", label: "Banner", hint: "Inline on matchup and bout pages. Image, about 1200 x 300." },
  { key: "interstitial", label: "Interstitial", hint: "Full-screen between pages. Image or short video." },
  { key: "preroll", label: "Pre-roll", hint: "Plays before a clip. MP4 or WebM, 15 to 30 seconds." },
];

const STATUS_LABEL: Record<Creative["status"], string> = {
  pending: "Waiting for review",
  active: "Live",
  paused: "Paused",
  ended: "Ended",
  rejected: "Not approved",
};

// A sponsor's self-serve ad shelf. A sponsor is the confirmed account whose
// email matches the contact email on an approved sponsorship (see
// my_sponsor_ids() in the database). New creatives start as "pending" and
// only an admin can make them serve, so nothing goes live unreviewed.
export default function SponsorCreatives() {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [state, setState] = useState<"loading" | "signed_out" | "no_sponsor" | "ready">("loading");
  const [userId, setUserId] = useState<string | null>(null);
  const [sponsors, setSponsors] = useState<{ id: string; name: string }[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [stats, setStats] = useState<Record<string, Stat>>({});

  const [sponsorId, setSponsorId] = useState("");
  const [placement, setPlacement] = useState<Placement>("banner");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [headline, setHeadline] = useState("");
  const [clickUrl, setClickUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setState("signed_out");
      return;
    }
    setUserId(userData.user.id);

    const { data: ids } = await supabase.rpc("my_sponsor_ids");
    const sponsorIds = ((ids as string[] | null) ?? []).filter(Boolean);
    if (sponsorIds.length === 0) {
      setState("no_sponsor");
      return;
    }
    const [{ data: sp }, { data: ads }, { data: st }] = await Promise.all([
      supabase.from("sponsors").select("id, name").in("id", sponsorIds).order("name"),
      supabase
        .from("ad_creatives")
        .select("id, sponsor_id, placement, media_type, media_url, click_url, headline, status, max_impressions, impressions_served, review_note")
        .in("sponsor_id", sponsorIds)
        .order("created_at", { ascending: false }),
      supabase.rpc("my_ad_stats"),
    ]);
    setSponsors(sp ?? []);
    setSponsorId((cur) => cur || (sp?.[0]?.id ?? ""));
    setCreatives((ads as Creative[]) ?? []);
    setStats(Object.fromEntries(((st as Stat[] | null) ?? []).map((r) => [r.ad_id, r])));
    setState("ready");
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked || !sponsorId) return;
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
      setError("That file is too large. The limit is 105 MB.");
      return;
    }
    setError(null);
    setUploading(true);
    const ext = file.type.startsWith("image/")
      ? (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg")
      : file.name.split(".").pop() || "mp4";
    const path = `sponsors/${sponsorId}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("ad-creatives").upload(path, file, { contentType: file.type });
    setUploading(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    const { data } = supabase.storage.from("ad-creatives").getPublicUrl(path);
    setMediaUrl(data.publicUrl);
    setMediaType(file.type.startsWith("video") ? "video" : "image");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!userId || !sponsorId || !mediaUrl) {
      setError("Upload your ad first.");
      return;
    }
    if (placement === "preroll" && mediaType !== "video") {
      setError("Pre-rolls need a video.");
      return;
    }
    let click: string | null = null;
    if (clickUrl.trim()) {
      try {
        const u = new URL(clickUrl.trim());
        if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("bad");
        click = u.toString();
      } catch {
        setError("The click-through link must start with https://");
        return;
      }
    }
    setSaving(true);
    const { error: insErr } = await supabase.from("ad_creatives").insert({
      sponsor_id: sponsorId,
      placement,
      media_type: mediaType,
      media_url: mediaUrl,
      click_url: click,
      headline: headline.trim() || null,
      status: "pending",
      weight: 1,
      submitted_by: userId,
    });
    setSaving(false);
    if (insErr) {
      setError(insErr.message);
      return;
    }
    setMediaUrl("");
    setHeadline("");
    setClickUrl("");
    if (fileRef.current) fileRef.current.value = "";
    setNotice("Submitted. It will show as Live here once we've approved it.");
    load();
  }

  async function remove(id: string) {
    setError(null);
    const { error: delErr } = await supabase.from("ad_creatives").delete().eq("id", id);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setCreatives((prev) => prev.filter((c) => c.id !== id));
  }

  if (state === "loading") return <p className="text-sm" style={{ color: "var(--text-faint)" }}>Loading…</p>;

  if (state === "signed_out") {
    return (
      <p className="rounded-lg p-4 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
        <Link href="/login?next=/sponsor/creatives" className="font-semibold underline">Sign in</Link> with the email you used for your sponsorship to manage your ads.
      </p>
    );
  }

  if (state === "no_sponsor") {
    return (
      <div className="rounded-lg p-4 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
        <p className="mb-2">
          We couldn&apos;t find an approved sponsorship for your account. Sign in with the same email you used at checkout.
          Sponsorships are activated by our team after payment, so a brand-new sponsorship can take a little while to appear.
        </p>
        <Link href="/sponsor" className="font-semibold underline">Become a sponsor</Link>
      </div>
    );
  }

  const selected = PLACEMENTS.find((p) => p.key === placement)!;

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="rounded bg-red-100 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded p-3 text-sm" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>{notice}</p>}

      <section>
        <h2 className="mb-3 text-lg font-semibold">Add an ad</h2>
        <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
          <div className="flex flex-wrap gap-3">
            {sponsors.length > 1 && (
              <select value={sponsorId} onChange={(e) => setSponsorId(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
                {sponsors.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
            <select value={placement} onChange={(e) => setPlacement(e.target.value as Placement)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }}>
              {PLACEMENTS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>
          <p className="text-xs" style={{ color: "var(--text-faint)" }}>{selected.hint}</p>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept={placement === "preroll" ? "video/mp4,video/webm" : "image/*,.heic,.heif,.avif,video/mp4,video/webm"}
              onChange={handleFilePick}
              className="text-xs"
            />
            {uploading && <span className="text-xs" style={{ color: "var(--text-faint)" }}>Uploading…</span>}
          </div>
          {mediaUrl && (
            mediaType === "video" ? (
              <video src={mediaUrl} muted controls className="h-28 w-auto rounded" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={mediaUrl} alt="Ad preview" className="h-28 w-auto rounded" />
            )
          )}

          <input type="text" maxLength={80} placeholder="Headline (optional)" value={headline} onChange={(e) => setHeadline(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
          <input type="url" placeholder="Click-through link, https://… (optional)" value={clickUrl} onChange={(e) => setClickUrl(e.target.value)} className="rounded border px-3 py-2 text-sm" style={{ borderColor: "var(--border)" }} />
          <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
            By submitting you confirm you own the rights to this ad. We review every ad before it runs and may decline
            ads that are misleading, unsafe or off-brand for the platform.
          </p>
          <button type="submit" disabled={saving || uploading || !mediaUrl} className="self-start rounded px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" style={{ background: "var(--red)" }}>
            {saving ? "Submitting…" : "Submit for review"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Your ads</h2>
        {creatives.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>No ads yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {creatives.map((c) => {
              const st = stats[c.id];
              const delivered = st ? Number(st.impressions) : c.impressions_served;
              return (
                <li key={c.id} className="flex flex-wrap items-center gap-3 rounded-lg border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                  {c.media_type === "video" ? (
                    <video src={c.media_url} muted className="h-14 w-14 flex-shrink-0 rounded object-cover" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.media_url} alt="" className="h-14 w-14 flex-shrink-0 rounded object-cover" />
                  )}
                  <div className="min-w-0 flex-1 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{c.headline ?? "Untitled ad"}</span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>{c.placement}</span>
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: c.status === "active" ? "var(--gold-soft)" : "var(--surface-2)", color: c.status === "active" ? "var(--gold)" : "var(--text-dim)" }}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>
                      {delivered.toLocaleString()} impressions
                      {c.max_impressions ? ` of ${c.max_impressions.toLocaleString()} agreed` : ""}
                      {st ? ` · ${Number(st.clicks).toLocaleString()} clicks` : ""}
                    </p>
                    {c.status === "rejected" && c.review_note && (
                      <p className="mt-0.5 text-xs text-red-700">{c.review_note}</p>
                    )}
                  </div>
                  {(c.status === "pending" || c.status === "rejected") && (
                    <button onClick={() => remove(c.id)} className="rounded border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: "var(--border)" }}>
                      Remove
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
