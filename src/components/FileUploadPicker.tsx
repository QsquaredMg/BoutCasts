"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  onUploaded: (url: string | null) => void;
};

const ACCEPT = "video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/webm,image/jpeg,image/png,image/webp";
const MAX_BYTES = 200 * 1024 * 1024; // 200MB, matches the storage bucket's limit

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileUploadPicker({ onUploaded }: Props) {
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "picked" | "uploading" | "uploaded" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;

    if (picked.size > MAX_BYTES) {
      setError(`That file is ${formatBytes(picked.size)} — the limit is 200 MB.`);
      return;
    }

    setError(null);
    setFile(picked);
    setPreviewUrl(URL.createObjectURL(picked));
    setStatus("picked");
    onUploaded(null);
  }

  function clear() {
    setFile(null);
    setPreviewUrl(null);
    setStatus("idle");
    setProgress(0);
    setError(null);
    onUploaded(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function upload() {
    if (!file) return;
    setStatus("uploading");
    setError(null);
    setProgress(0);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setError("Sign in to upload a file.");
      setStatus("picked");
      return;
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
    const path = `${user.id}/${Date.now()}.${ext}`;

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
    onUploaded(urlData.publicUrl);
  }

  const isVideo = file?.type.startsWith("video/");
  const isAudio = file?.type.startsWith("audio/");
  const isImage = file?.type.startsWith("image/");

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        onChange={handlePick}
        className="hidden"
        id="submission-file-input"
      />

      {!file && (
        <label
          htmlFor="submission-file-input"
          className="flex aspect-video cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed text-center"
          style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
        >
          <span className="text-2xl">📁</span>
          <span className="text-sm font-semibold" style={{ color: "var(--text-dim)" }}>
            Tap to choose a video, audio, or image file
          </span>
          <span className="text-xs">MP4, WebM, MOV, MP3, WAV, JPG, PNG — up to 200 MB</span>
        </label>
      )}

      {file && previewUrl && (
        <div
          className="relative mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-xl"
          style={{ background: "linear-gradient(155deg,#20222b,#101116 70%)" }}
        >
          {isVideo && <video src={previewUrl} controls className="h-full w-full object-contain" />}
          {isImage && <img src={previewUrl} alt={file.name} className="h-full w-full object-contain" />}
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
        </p>
      )}

      {error && <p className="mb-2 text-sm" style={{ color: "var(--red)" }}>{error}</p>}

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
