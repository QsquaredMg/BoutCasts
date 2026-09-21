"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  onRecorded: (path: string | null) => void;
};

export default function InAppRecorder({ onRecorded }: Props) {
  const supabase = createClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [status, setStatus] = useState<"idle" | "recording" | "recorded" | "uploading" | "uploaded" | "error">("idle");
  const [seconds, setSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        await videoRef.current.play();
      }

      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "video/webm" });
        setPreviewUrl(URL.createObjectURL(blob));
        setStatus("recorded");
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      recorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't access camera/mic");
      setStatus("error");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  }

  function retake() {
    setPreviewUrl(null);
    setStatus("idle");
    onRecorded(null);
  }

  async function upload() {
    if (chunksRef.current.length === 0) return;
    setStatus("uploading");
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setError("Sign in to upload your recording.");
      setStatus("recorded");
      return;
    }

    const blob = new Blob(chunksRef.current, { type: "video/webm" });
    const path = `${user.id}/${Date.now()}.webm`;

    const { error: uploadError } = await supabase.storage
      .from("submission-clips")
      .upload(path, blob, { contentType: "video/webm" });

    if (uploadError) {
      setError(uploadError.message);
      setStatus("recorded");
      return;
    }

    const { data: urlData } = supabase.storage.from("submission-clips").getPublicUrl(path);
    setStatus("uploaded");
    onRecorded(urlData.publicUrl);
  }

  return (
    <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div
        className="relative mb-3 flex aspect-video items-center justify-center overflow-hidden rounded-xl"
        style={{ background: "linear-gradient(155deg,#20222b,#101116 70%)" }}
      >
        {status === "recorded" || status === "uploading" || status === "uploaded" ? (
          previewUrl && <video src={previewUrl} controls className="h-full w-full object-contain" />
        ) : (
          <video ref={videoRef} className="h-full w-full object-contain" playsInline />
        )}
        {status === "recording" && (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 text-xs font-bold text-white">
            <span className="bc-live-dot" />
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </div>
        )}
        {status === "idle" && (
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.5)" }}>
            Camera preview will appear here
          </span>
        )}
      </div>

      {error && <p className="mb-2 text-sm" style={{ color: "var(--red)" }}>{error}</p>}

      <div className="flex justify-center gap-2">
        {status === "idle" && (
          <button type="button" onClick={startRecording} className="bc-btn-red px-5 py-2.5">
            ● Start Recording
          </button>
        )}
        {status === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="rounded-full border px-5 py-2.5 text-sm font-bold"
            style={{ borderColor: "var(--red)", color: "var(--red)", fontFamily: "var(--font-display)" }}
          >
            ■ Stop
          </button>
        )}
        {status === "recorded" && (
          <>
            <button type="button" onClick={retake} className="rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}>
              Retake
            </button>
            <button type="button" onClick={upload} className="bc-btn-red px-5 py-2">
              Use this clip
            </button>
          </>
        )}
        {status === "uploading" && (
          <span className="text-sm font-bold" style={{ color: "var(--text-faint)" }}>
            Uploading...
          </span>
        )}
        {status === "uploaded" && (
          <span className="text-sm font-bold" style={{ color: "var(--blue)" }}>
            ✓ Clip attached — ready to submit
          </span>
        )}
      </div>
    </div>
  );
}
