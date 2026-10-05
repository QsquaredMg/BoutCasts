"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageField from "@/components/ImageField";
import ClipSourcePicker, { type ClipSourceValue } from "@/components/ClipSourcePicker";
import OptionAvatar from "@/components/OptionAvatar";
import { MediaPreview } from "@/components/LiveVoteOptionMediaManager";
import { SPEECH_MAX_SECONDS, formatDuration } from "@/lib/mediaDuration";

// The page a candidate opens from their private link: add a profile photo and a
// speech (3 min max). The organizer approves it before voters see it.

type Media = {
  thumbnail_url: string | null;
  image_url: string | null;
  source_type: string | null;
  source_url: string | null;
  media_seconds: number | null;
  description: string | null;
};
type Info = {
  option_name: string;
  team_name: string | null;
  event_title: string;
  event_status: "draft" | "live" | "closed";
  closes_at: string | null;
  brand_name: string | null;
  brand_logo_url: string | null;
  current: Media;
  latest: (Media & { status: "pending" | "approved" | "rejected"; submitted_at: string }) | null;
};

const inputClass = "w-full rounded-[10px] border px-3 py-2 text-sm";
const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };

export default function CandidateMediaForm({ token }: { token: string }) {
  const [info, setInfo] = useState<Info | null | undefined>(undefined);
  const [thumb, setThumb] = useState<string | null>(null);
  const [clip, setClip] = useState<ClipSourceValue>({ sourceType: "upload", sourceUrl: null });
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    createClient()
      .rpc("get_live_vote_candidate", { p_token: token })
      .then(({ data }) => {
        const i = (data as Info | null) ?? null;
        setInfo(i);
        if (i) {
          const start = i.latest?.status === "pending" ? i.latest : i.current;
          setThumb(start.thumbnail_url);
          setDescription(start.description ?? "");
          if (start.source_url) {
            setClip({
              sourceType: (start.source_type as ClipSourceValue["sourceType"]) ?? "link",
              sourceUrl: start.source_url,
              seconds: start.media_seconds,
            });
          }
        }
      });
  }, [token]);

  if (info === undefined) {
    return <p style={{ color: "var(--text-faint)" }}>Loading…</p>;
  }
  if (info === null) {
    return (
      <div className="rounded-2xl border p-6 text-center" style={inputStyle}>
        <p className="text-lg font-bold">This link isn&apos;t valid</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
          Ask the organizer for a new candidate link.
        </p>
      </div>
    );
  }

  const closed = info.event_status === "closed";

  async function submit() {
    if (clip.tooLong) return setError("Your video is over 3 minutes. Use a shorter clip.");
    setBusy(true);
    setError(null);
    const url = clip.sourceUrl?.trim() || null;
    const { error } = await createClient().rpc("submit_live_vote_candidate_media", {
      p_token: token,
      p_thumbnail_url: thumb ?? "",
      p_image_url: info?.current.image_url ?? "",
      p_source_type: url ? clip.sourceType : null,
      p_source_url: url ?? "",
      p_media_seconds: url && clip.seconds != null ? Math.min(Math.round(clip.seconds), SPEECH_MAX_SECONDS) : null,
      p_description: description,
    });
    setBusy(false);
    if (error) return setError(error.message);
    setSent(true);
  }

  const prefix = `candidates/${token}`;
  const label = "mb-1 block text-sm font-semibold";

  return (
    <div>
      {info.brand_logo_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={info.brand_logo_url} alt={info.brand_name ?? ""} className="mb-3 h-12 w-auto object-contain" />
      )}
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
        {info.event_title}
      </p>
      <h1 className="mt-1 text-2xl font-bold">Hi {info.option_name} 👋</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
        Add a profile photo and a short speech or video (up to {formatDuration(SPEECH_MAX_SECONDS)}) so voters can see who they&apos;re voting for.
        The organizer reviews it before it goes on the ballot.
      </p>

      {sent ? (
        <div className="mt-6 rounded-2xl border p-6 text-center" style={inputStyle}>
          <p className="text-3xl">✅</p>
          <p className="mt-2 text-lg font-bold">Sent for approval</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
            You&apos;ll show up with your photo and speech once the organizer approves it. You can come back to this link to change it.
          </p>
          <button type="button" onClick={() => setSent(false)} className="mt-4 text-sm font-semibold underline" style={{ color: "var(--red)" }}>
            Make changes
          </button>
        </div>
      ) : closed ? (
        <div className="mt-6 rounded-2xl border p-6 text-center" style={inputStyle}>
          <p className="font-bold">Voting has closed</p>
          <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
            Your entry can&apos;t be changed anymore.
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-5 rounded-2xl border p-5" style={inputStyle}>
          {info.latest?.status === "pending" && (
            <p className="rounded-lg p-2.5 text-xs" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
              ⏳ You sent an update on {new Date(info.latest.submitted_at).toLocaleString()} — it&apos;s waiting for approval. Sending again replaces it.
            </p>
          )}
          {info.latest?.status === "rejected" && (
            <p className="rounded-lg p-2.5 text-xs" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
              Your last update wasn&apos;t approved. You can send a new one.
            </p>
          )}
          <div>
            <span className={label}>Profile photo</span>
            <div className="flex items-center gap-3">
              <OptionAvatar name={info.option_name} url={thumb} size={64} />
              <div className="flex-1">
                <ImageField value={null} onChange={(v) => v && setThumb(v)} label={thumb ? "new photo" : "your photo"} uploadPrefix={prefix} />
                {thumb && (
                  <button type="button" onClick={() => setThumb(null)} className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                    Remove photo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <span className={label}>Speech or video (up to {formatDuration(SPEECH_MAX_SECONDS)})</span>
            {clip.sourceUrl && (
              <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>
                Current: {clip.sourceType === "link" ? clip.sourceUrl : "your uploaded video"}
                {clip.seconds ? ` · ${formatDuration(clip.seconds)}` : ""} ·{" "}
                <button type="button" className="underline" onClick={() => setClip({ sourceType: "upload", sourceUrl: null })}>
                  remove
                </button>
              </p>
            )}
            <ClipSourcePicker
              value={clip}
              onChange={setClip}
              maxSeconds={SPEECH_MAX_SECONDS}
              uploadPrefix={prefix}
              inputClass={inputClass}
              inputStyle={inputStyle}
            />
          </div>

          <div>
            <span className={label}>A few words about you ({description.length}/500)</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              className={inputClass}
              style={{ ...inputStyle, minHeight: 80 }}
              placeholder="Why should people vote for you?"
            />
          </div>

          {error && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {error}
            </p>
          )}
          <button type="button" onClick={submit} disabled={busy} className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60">
            {busy ? "Sending…" : "Send for approval"}
          </button>
        </div>
      )}

      {(info.current.thumbnail_url || info.current.source_url) && !sent && (
        <div className="mt-6">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            What voters see now
          </p>
          <MediaPreview name={info.option_name} m={info.current} />
        </div>
      )}
    </div>
  );
}
