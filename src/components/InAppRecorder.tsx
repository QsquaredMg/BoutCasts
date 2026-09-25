"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  onRecorded: (path: string | null) => void;
};

// Pick a recording format this browser supports. MP4 first: Safari/iPhone
// can't record WebM reliably and can't play back WebM recordings without
// duration metadata, while MP4 plays everywhere (including voters' iPhones).
const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1,mp4a",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

function pickRecordingMime(): string {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return "";
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

// "video/mp4;codecs=avc1" -> "video/mp4" (the storage bucket allow-list
// matches plain types).
function baseType(mime: string) {
  return (mime.split(";")[0] || "video/webm").trim();
}

export default function InAppRecorder({ onRecorded }: Props) {
  const supabase = createClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("video/webm");

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
      const wanted = pickRecordingMime();
      const recorder = wanted ? new MediaRecorder(stream, { mimeType: wanted }) : new MediaRecorder(stream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        // Some browsers deliver the last chunk right around "stop"; build the
        // preview on the next tick so it's included.
        setTimeout(() => {
          const type = baseType(recorder.mimeType || wanted || chunksRef.current[0]?.type || "video/webm");
          mimeRef.current = type;
          const blob = new Blob(chunksRef.current, { type });
          if (blob.size === 0) {
            setError("The recording came out empty — please try again.");
            setStatus("idle");
          } else {
            setPreviewUrl(URL.createObjectURL(blob));
            setStatus("recorded");
          }
          streamRef.current?.getTracks().forEach((t) => t.stop());
          if (videoRef.current) videoRef.current.srcObject = null;
        }, 0);
      };
      recorderRef.current = recorder;
      // Timeslice: collect data every second instead of only at the end.
      recorder.start(1000);
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
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    chunksRef.current = [];
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

    const type = mimeRef.current;
    const blob = new Blob(chunksRef.current, { type });
    const ext = type === "video/mp4" ? "mp4" : "webm";
    const path = `${user.id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("submission-clips")
      .upload(path, blob, { contentType: type });

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
          previewUrl && (
            <video
              key={previewUrl}
              src={previewUrl}
              controls
              playsInline
              preload="auto"
              className="h-full w-full object-contain"
            />
          )
        ) : (
          <video ref={videoRef} className="h-full w-full object-contain" playsInline muted autoPlay />
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
