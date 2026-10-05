"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageField from "@/components/ImageField";
import ClipSourcePicker, { type ClipSourceValue } from "@/components/ClipSourcePicker";
import OptionAvatar from "@/components/OptionAvatar";
import { SPEECH_MAX_SECONDS, formatDuration } from "@/lib/mediaDuration";

// Organizer: each option's profile photo, photo, speech/video (3 min max) and
// blurb — editable until voting closes. Also hands out a private link so each
// candidate can send their own photo and speech, which the organizer approves.

type OptionRow = {
  id: string;
  name: string;
  thumbnail_url: string | null;
  image_url: string | null;
  source_type: "upload" | "link" | "record" | null;
  source_url: string | null;
  media_seconds: number | null;
  description: string | null;
};

type Submission = {
  id: string;
  option_id: string;
  thumbnail_url: string | null;
  image_url: string | null;
  source_type: string | null;
  source_url: string | null;
  media_seconds: number | null;
  description: string | null;
  submitted_at: string;
};

const box = { borderColor: "var(--border)", background: "var(--surface)" };
const inputClass = "w-full rounded-[10px] border px-3 py-2 text-sm";
const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };

export default function LiveVoteOptionMediaManager({
  eventId,
  status,
  onChanged,
}: {
  eventId: string;
  status: "draft" | "live" | "closed";
  onChanged?: () => void;
}) {
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [pending, setPending] = useState<Submission[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const editable = status !== "closed";

  const load = useCallback(async () => {
    const supabase = createClient();
    const [{ data: o }, { data: p }] = await Promise.all([
      supabase
        .from("live_vote_options")
        .select("id, name, thumbnail_url, image_url, source_type, source_url, media_seconds, description")
        .eq("event_id", eventId)
        .order("sort_order"),
      supabase
        .from("live_vote_option_submissions")
        .select("id, option_id, thumbnail_url, image_url, source_type, source_url, media_seconds, description, submitted_at")
        .eq("event_id", eventId)
        .eq("status", "pending")
        .order("submitted_at"),
    ]);
    setOptions((o as OptionRow[]) ?? []);
    setPending((p as Submission[]) ?? []);
  }, [eventId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function candidateLink(optionId: string, regenerate = false) {
    setMsg(null);
    const { data, error } = await createClient().rpc("live_vote_option_candidate_token", {
      p_option_id: optionId,
      p_regenerate: regenerate,
    });
    if (error) return setMsg(error.message);
    setLinks((l) => ({ ...l, [optionId]: `${window.location.origin}/vote/candidate/${data as string}` }));
  }

  async function copy(optionId: string) {
    const link = links[optionId];
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(optionId);
      setTimeout(() => setCopied(null), 2000);
    } catch {}
  }

  async function review(id: string, approve: boolean) {
    setMsg(null);
    const { error } = await createClient().rpc("review_live_vote_candidate_media", { p_submission_id: id, p_approve: approve });
    if (error) return setMsg(error.message);
    await load();
    onChanged?.();
  }

  return (
    <div className="mb-4 rounded-xl border p-3.5" style={box}>
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 text-left">
        <span>
          <span className="block text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            🧑 Options: photos &amp; speeches
            {pending.length > 0 && (
              <span className="ml-2 rounded-full px-2 py-0.5 text-[10px] text-white" style={{ background: "var(--red)" }}>
                {pending.length} to review
              </span>
            )}
          </span>
          <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
            Profile photo and a speech or video (3 min max) for each option. Send candidates a link to add their own.
          </span>
        </span>
        <span className="text-sm font-bold" style={{ color: "var(--red)" }}>
          {open ? "Close" : "Edit"}
        </span>
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          {!editable && (
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Voting has closed, so options can&apos;t change.
            </p>
          )}
          {msg && (
            <p className="text-xs" style={{ color: "var(--danger)" }}>
              {msg}
            </p>
          )}
          {options.map((o) => {
            const sub = pending.find((p) => p.option_id === o.id);
            return (
              <div key={o.id} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-3">
                  <OptionAvatar name={o.name} url={o.thumbnail_url} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{o.name}</p>
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                      {[
                        o.thumbnail_url ? "Profile photo" : "No profile photo",
                        o.source_url ? `Speech${o.media_seconds ? ` ${formatDuration(o.media_seconds)}` : ""}` : null,
                        o.image_url ? "Photo" : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  {editable && (
                    <button
                      type="button"
                      onClick={() => setEditing(editing === o.id ? null : o.id)}
                      className="text-xs font-bold"
                      style={{ color: "var(--red)" }}
                    >
                      {editing === o.id ? "Cancel" : "Edit"}
                    </button>
                  )}
                </div>

                {editing === o.id && (
                  <OptionEditor
                    option={o}
                    onSaved={async () => {
                      setEditing(null);
                      await load();
                      onChanged?.();
                    }}
                  />
                )}

                {sub && (
                  <div className="mt-3 rounded-lg border p-3" style={{ borderColor: "var(--red)", background: "var(--surface-2)" }}>
                    <p className="mb-2 text-xs font-bold" style={{ color: "var(--red)" }}>
                      Sent by the candidate · {new Date(sub.submitted_at).toLocaleString()}
                    </p>
                    <MediaPreview name={o.name} m={sub} />
                    {editable && (
                      <div className="mt-2 flex gap-2">
                        <button type="button" onClick={() => review(sub.id, true)} className="bc-btn-solid rounded-full px-4 py-1.5 text-xs font-bold">
                          Approve &amp; publish
                        </button>
                        <button
                          type="button"
                          onClick={() => review(sub.id, false)}
                          className="rounded-full border px-4 py-1.5 text-xs font-bold"
                          style={{ borderColor: "var(--border)" }}
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {editable && (
                  <div className="mt-2 text-xs">
                    {links[o.id] ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="min-w-0 flex-1 truncate rounded px-2 py-1" style={{ background: "var(--surface-2)" }}>
                          {links[o.id]}
                        </code>
                        <button type="button" onClick={() => copy(o.id)} className="font-bold" style={{ color: "var(--red)" }}>
                          {copied === o.id ? "Copied!" : "Copy"}
                        </button>
                        <button type="button" onClick={() => candidateLink(o.id, true)} style={{ color: "var(--text-faint)" }}>
                          New link
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => candidateLink(o.id)} className="font-semibold" style={{ color: "var(--text-dim)" }}>
                        🔗 Candidate upload link
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
            A candidate link lets that person add their own profile photo and speech without an account. Nothing goes on the voting page until
            you approve it. &ldquo;New link&rdquo; turns off the old one.
          </p>
        </div>
      )}
    </div>
  );
}

function OptionEditor({ option, onSaved }: { option: OptionRow; onSaved: () => void }) {
  const [thumb, setThumb] = useState(option.thumbnail_url);
  const [image, setImage] = useState(option.image_url);
  const [clip, setClip] = useState<ClipSourceValue>({
    sourceType: (option.source_type as ClipSourceValue["sourceType"]) ?? "upload",
    sourceUrl: option.source_url,
    seconds: option.media_seconds,
  });
  const [description, setDescription] = useState(option.description ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (clip.tooLong) return setError("That video is over 3 minutes. Use a shorter clip.");
    setBusy(true);
    setError(null);
    const url = clip.sourceUrl?.trim() || null;
    const { error } = await createClient().rpc("update_live_vote_option_media", {
      p_option_id: option.id,
      p_thumbnail_url: thumb ?? "",
      p_image_url: image ?? "",
      p_source_type: url ? clip.sourceType : null,
      p_source_url: url ?? "",
      p_media_seconds: url && clip.seconds != null ? Math.min(Math.round(clip.seconds), SPEECH_MAX_SECONDS) : null,
      p_description: description,
    });
    setBusy(false);
    if (error) return setError(error.message);
    onSaved();
  }

  const label = "mb-1 block text-xs font-semibold";
  return (
    <div className="mt-3 flex flex-col gap-3 border-t pt-3" style={{ borderColor: "var(--border)" }}>
      <div>
        <span className={label} style={{ color: "var(--text-dim)" }}>
          Profile photo
        </span>
        <div className="flex items-center gap-3">
          <OptionAvatar name={option.name} url={thumb} size={44} />
          <div className="flex-1">
            <ImageField value={null} onChange={(v) => v && setThumb(v)} label={thumb ? "new photo" : "profile photo"} />
            {thumb && (
              <button type="button" onClick={() => setThumb(null)} className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                Remove photo (show initials)
              </button>
            )}
          </div>
        </div>
      </div>
      <div>
        <span className={label} style={{ color: "var(--text-dim)" }}>
          Speech / video (3 min max)
        </span>
        {clip.sourceUrl && (
          <p className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>
            Current: {clip.sourceType === "link" ? clip.sourceUrl : "uploaded video"}
            {clip.seconds ? ` · ${formatDuration(clip.seconds)}` : ""} ·{" "}
            <button type="button" className="underline" onClick={() => setClip({ sourceType: "upload", sourceUrl: null })}>
              remove
            </button>
          </p>
        )}
        <ClipSourcePicker value={clip} onChange={setClip} maxSeconds={SPEECH_MAX_SECONDS} inputClass={inputClass} inputStyle={inputStyle} />
      </div>
      <div>
        <span className={label} style={{ color: "var(--text-dim)" }}>
          Big photo (optional)
        </span>
        <ImageField value={image} onChange={setImage} wide />
      </div>
      <div>
        <span className={label} style={{ color: "var(--text-dim)" }}>
          Description ({description.length}/500)
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          className={inputClass}
          style={{ ...inputStyle, minHeight: 60 }}
        />
      </div>
      {error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
      <button type="button" onClick={save} disabled={busy} className="bc-btn-solid rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60">
        {busy ? "Saving…" : "Save option"}
      </button>
    </div>
  );
}

export function MediaPreview({
  name,
  m,
}: {
  name: string;
  m: { thumbnail_url: string | null; image_url: string | null; source_type: string | null; source_url: string | null; media_seconds: number | null; description: string | null };
}) {
  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center gap-3">
        <OptionAvatar name={name} url={m.thumbnail_url} size={44} />
        {m.source_url ? (
          <a href={m.source_url} target="_blank" rel="noreferrer" className="text-xs font-semibold underline" style={{ color: "var(--red)" }}>
            ▶ Watch speech{m.media_seconds ? ` (${formatDuration(m.media_seconds)})` : ""}
          </a>
        ) : (
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            No speech
          </span>
        )}
      </div>
      {m.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.image_url} alt="" className="max-h-40 rounded-lg object-cover" />
      )}
      {m.description && (
        <p className="text-xs" style={{ color: "var(--text-dim)" }}>
          {m.description}
        </p>
      )}
    </div>
  );
}
