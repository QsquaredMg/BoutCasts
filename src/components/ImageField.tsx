"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { prepareImage, isPhotoFile, PHOTO_ACCEPT, PHOTO_FORMATS_LABEL, UnsupportedPhotoError } from "@/lib/prepareImage";

// A photo: upload one (any common format — iPhone HEIC etc. are converted, big
// photos shrunk) or paste an image link. Uploads go to the clips bucket.

export default function ImageField({
  value,
  onChange,
  label = "photo",
  wide = false,
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  /** Used in button text, e.g. "Upload photo" / "Upload logo". */
  label?: string;
  /** Show a wide (16:9) preview instead of a square thumbnail. */
  wide?: boolean;
}) {
  const inputId = `img-${useId().replace(/:/g, "")}`;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState("");

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!isPhotoFile(picked)) return setError(`Use a photo: ${PHOTO_FORMATS_LABEL}.`);
    setBusy(true);
    setError(null);
    const supabase = createClient();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      setBusy(false);
      return setError("Sign in to upload.");
    }
    let file: File;
    try {
      file = await prepareImage(picked);
    } catch (err) {
      setBusy(false);
      return setError(err instanceof UnsupportedPhotoError ? err.message : "We couldn't read that photo.");
    }
    const ext = (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg");
    const path = `${u.user.id}/img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("submission-clips").upload(path, file, { contentType: file.type });
    setBusy(false);
    if (upErr) return setError(upErr.message);
    onChange(supabase.storage.from("submission-clips").getPublicUrl(path).data.publicUrl);
  }

  function applyLink() {
    const v = link.trim();
    if (!/^https:\/\/\S+$/i.test(v)) return setError("Paste a full image link starting with https://");
    setError(null);
    onChange(v);
    setLink("");
  }

  if (value) {
    return (
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={value}
          alt=""
          className={`${wide ? "h-16 w-28" : "h-14 w-14"} flex-shrink-0 rounded-lg border object-cover`}
          style={{ borderColor: "var(--border)" }}
        />
        <button type="button" onClick={() => onChange(null)} className="text-xs font-semibold" style={{ color: "var(--text-faint)" }}>
          Remove
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
        >
          {busy ? "Uploading…" : `📷 Upload ${label}`}
        </label>
        <input id={inputId} type="file" accept={PHOTO_ACCEPT} onChange={pick} className="sr-only" disabled={busy} />
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          or
        </span>
        <input
          type="url"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              applyLink();
            }
          }}
          placeholder="paste an image link"
          className="min-w-0 flex-1 rounded-lg border px-2.5 py-1.5 text-xs"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        />
        {link.trim() && (
          <button type="button" onClick={applyLink} className="text-xs font-bold" style={{ color: "var(--red)" }}>
            Add
          </button>
        )}
      </div>
      {error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
