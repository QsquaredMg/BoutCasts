"use client";

import { startTransition, useId, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { prepareImage, isPhotoFile, UnsupportedPhotoError } from "@/lib/prepareImage";
import { fileDuration, formatDuration } from "@/lib/mediaDuration";

type Props = {
  onUploaded: (url: string | null, durationSeconds?: number | null) => void;
  /** Hard cap for video/audio length. Longer files are refused before upload. */
  maxSeconds?: number;
  /** Only accept video and audio (no photos). */
  mediaOnly?: boolean;
  /** Upload into this storage folder without needing a signed-in user (candidate links). */
  uploadPrefix?: string;
};

const ACCEPT =
  "video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/webm,image/*,.heic,.heif,.avif,.bmp,.tif,.tiff,.svg";
const MEDIA_ACCEPT = "video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/webm";
const MAX_BYTES = 777 * 1024 * 1024; // 777MB, matches the storage bucket's limit

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUploadPicker({ onUploaded, maxSeconds, mediaOnly, uploadPrefix }: Props) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  // Each picker needs its own input id: the Live Vote form shows several at
  // once (brand logo, graphic, one per option), and a shared id made every
  // "choose a file" label open the first picker on the page instead.
  const inputId = `file-input-${useId().replace(/:/g, "")}`;

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "optimizing" | "picked" | "uploading" | "uploaded" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;

    if (picked.size > MAX_BYTES) {
      setError(`That file is ${formatBytes(picked.size)} — the limit is 777 MB.`);
      return;
    }

    const isMedia = picked.type.startsWith("video/") || picked.type.startsWith("audio/") || /\.(mp4|mov|webm|m4a|mp3|wav)$/i.test(picked.name);
    if (mediaOnly && !isMedia) {
      setError("Choose a video or audio file.");
      return;
    }
    let secs: number | null = null;
    if (isMedia && maxSeconds) {
      secs = await fileDuration(picked);
      if (secs == null) {
        setError("We couldn't read how long that video is. Try an MP4 or MOV file.");
        return;
      }
      if (secs > maxSeconds + 0.5) {
        setError(`That video is ${formatDuration(secs)} — the limit is ${formatDuration(maxSeconds)}. Trim it and try again.`);
        if (inputRef.current) inputRef.current.value = "";
        return;
      }
    }
    setDuration(secs);

    setError(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    // Re-rendering the whole parent form is not urgent — let this box paint first.
    startTransition(() => onUploaded(null));

    let ready = picked;
    if (isPhotoFile(picked) && !picked.type.startsWith("video/") && !picked.type.startsWith("audio/")) {
      // Convert (HEIC, AVIF, BMP, TIFF, SVG…) and shrink big phone photos before preview + upload.
      setStatus("optimizing");
      try {
        ready = await prepareImage(picked);
      } catch (err) {
        setStatus("idle");
        setError(err instanceof UnsupportedPhotoError ? err.message : "We couldn't read that photo.");
        return;
      }
    }

    setFile(ready);
    setPreviewUrl(URL.createObjectURL(ready));
    setStatus("picked");
  }

  function clear() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setStatus("idle");
    setProgress(0);
    setError(null);
    setDuration(null);
    onUploaded(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function upload() {
    if (!file) return;
    setStatus("uploading");
    setError(null);
    setProgress(0);

    let folder = uploadPrefix;
    if (!folder) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setError("Sign in to upload a file.");
        setStatus("picked");
        return;
      }
      folder = userData.user.id;
    }

    const ext = file.type.startsWith("image/")
      ? (file.type.split("/")[1] || "jpg").replace("jpeg", "jpg")
      : file.name.includes(".")
        ? file.name.split(".").pop()
        : "bin";
    const path = `${folder}/${Date.now()}.${ext}`;

    // The Supabase JS client doesn't expose upload progress for a plain
    // `upload()` call, so we show an indeterminate state while it runs.
    const { error: uploadError } = await supabase.storage
      .from("submission-clips")
      .upload(path, file, { contentType: file.type || undefined });

    if (uploadError) {
      setError(uploadError.message);
      setStatus("picked");
      return;
    }

    setProgress(100);
    const { data: urlData } = supabase.storage.from("submission-clips").getPublicUrl(path);
    setStatus("uploaded");
    onUploaded(urlData.publicUrl, duration == null ? null : Math.round(duration));
  }

  const isVideo = file?.type.startsWith("video/");
  const isAudio = file?.type.startsWith("audio/");
  const isImage = file?.type.startsWith("image/");

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <input
        ref={inputRef}
        type="file"
        accept={mediaOnly ? MEDIA_ACCEPT : ACCEPT}
        onChange={handlePick}
        className="hidden"
        id={inputId}
      />

      {!file && (
        <label
          htmlFor={inputId}
          className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center"
          style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
        >
          <span className="text-2xl">📁</span>
          <span className="text-sm font-semibold" style={{ color: "var(--text-dim)" }}>
            {mediaOnly ? "Tap to choose a video or audio file" : "Tap to choose a video, audio, or image file"}
          </span>
          <span className="text-xs">
            {mediaOnly ? "MP4, MOV, WebM or audio" : "Video, audio or any photo (JPG, PNG, HEIC, WebP, GIF…)"}
            {maxSeconds ? ` — ${formatDuration(maxSeconds)} max` : " — up to 777 MB"}
          </span>
        </label>
      )}

      {file && previewUrl && (
        <div
          className="relative mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-xl"
          style={{ background: "linear-gradient(155deg,#20222b,#101116 70%)" }}
        >
          {isVideo && <video src={previewUrl} controls className="h-full w-full object-contain" />}
          {isImage && <img src={previewUrl} alt={file.name} decoding="async" className="h-full w-full object-contain" />}
          {isAudio && (
            <div className="flex w-full flex-col items-center gap-3 px-6">
              <span className="text-3xl">🎧</span>
              <audio src={previewUrl} controls className="w-full" />
            </div>
          )}
        </div>
      )}

      {file && (
        <p className="mb-2 truncate text-xs" style={{ color: "var(--text-faint)" }}>
          {file.name} &middot; {formatBytes(file.size)}
          {duration != null && <> &middot; {formatDuration(duration)}</>}
        </p>
      )}

      {error && <p className="mb-2 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

      <div className="flex justify-center gap-2">
        {status === "picked" && (
          <>
            <button
              type="button"
              onClick={clear}
              className="rounded-full border px-4 py-2 text-sm font-bold"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              Choose different file
            </button>
            <button type="button" onClick={upload} className="bc-btn-red px-5 py-2">
              Use this file
            </button>
          </>
        )}
        {status === "optimizing" && (
          <span className="text-sm font-bold" style={{ color: "var(--text-faint)" }}>
            Optimizing photo…
          </span>
        )}
        {status === "uploading" && (
          <span className="text-sm font-bold" style={{ color: "var(--text-faint)" }}>
            Uploading{progress > 0 ? `… ${progress}%` : "…"}
          </span>
        )}
        {status === "uploaded" && (
          <>
            <span className="text-sm font-bold" style={{ color: "var(--blue)" }}>
              ✓ File attached — ready to submit
            </span>
            <button
              type="button"
              onClick={clear}
              className="text-xs font-semibold underline"
              style={{ color: "var(--text-faint)" }}
            >
              Replace
            </button>
          </>
        )}
      </div>
    </div>
  );
}
