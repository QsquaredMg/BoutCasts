"use client";

import { useId, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { prepareImage, isPhotoFile, PHOTO_ACCEPT, PHOTO_FORMATS_LABEL, UnsupportedPhotoError } from "@/lib/prepareImage";

// Upload a logo (any common photo format; converted and shrunk in the browser,
// 5 MB max after that) to the sponsor-logos bucket, or paste a logo URL instead. `folder` is "applications" for brands
// applying publicly, or "sponsors" for admins.

export default function LogoUploadField({
  value,
  onChange,
  folder = "applications",
  compact = false,
}: {
  value: string;
  onChange: (url: string) => void;
  folder?: "applications" | "sponsors" | "teams";
  compact?: boolean;
}) {
  const supabase = createClient();
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!isPhotoFile(picked)) {
      setError(`Use an image: ${PHOTO_FORMATS_LABEL}.`);
      return;
    }
    setBusy(true);
    setError(null);
    let file: File;
    try {
      file = await prepareImage(picked);
    } catch (err) {
      setBusy(false);
      setError(err instanceof UnsupportedPhotoError ? err.message : "We couldn't read that image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setBusy(false);
      setError("Logo must be 5 MB or smaller.");
      return;
    }
    const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("sponsor-logos").upload(path, file, { contentType: file.type });
    setBusy(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    onChange(supabase.storage.from("sponsor-logos").getPublicUrl(path).data.publicUrl);
  }

  return (
    <div className={compact ? "flex min-w-[220px] flex-1 flex-col gap-1" : "flex flex-col gap-1.5"}>
      <div className="flex items-center gap-2">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Logo preview" className="h-10 w-10 shrink-0 rounded-lg border bg-white object-contain p-0.5" style={{ borderColor: "var(--border)" }} />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border text-[10px]" style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}>
            Logo
          </span>
        )}
        <label
          htmlFor={inputId}
          className="cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
        >
          {busy ? "Uploading…" : value ? "Replace logo" : "Upload logo"}
        </label>
        <input id={inputId} type="file" accept={PHOTO_ACCEPT} onChange={pick} className="sr-only" />
        {value && (
          <button type="button" onClick={() => onChange("")} className="text-xs underline" style={{ color: "var(--text-faint)" }}>
            Remove
          </button>
        )}
      </div>
      <input
        type="url"
        placeholder="…or paste a logo URL"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border px-3 py-1.5 text-xs outline-none"
        style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
      />
      {error && (
        <p className="text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
