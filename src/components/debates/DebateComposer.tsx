"use client";

import { useState } from "react";
import InAppRecorder from "@/components/InAppRecorder";
import FileUploadPicker from "@/components/FileUploadPicker";
import { createClient } from "@/lib/supabase/client";
import { formatDuration, loadYouTubeApi, MAX_DEBATE_SECONDS, youTubeId } from "@/lib/debates";

type Ready = { type: "record" | "upload" | "link"; url: string; seconds: number };

function readFileDuration(url: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = () => {
      if (Number.isFinite(v.duration) && v.duration > 0) resolve(Math.round(v.duration));
      else reject(new Error("unreadable"));
    };
    v.onloadedmetadata = () => {
      // Some recordings report Infinity until you seek to the end.
      if (!Number.isFinite(v.duration)) {
        v.currentTime = 1e9;
        v.ontimeupdate = () => {
          v.ontimeupdate = null;
          done();
        };
      } else done();
    };
    v.onerror = () => reject(new Error("unreadable"));
    v.src = url;
  });
}

function readYouTubeDuration(id: string): Promise<number> {
  return loadYouTubeApi().then(
    (YT) =>
      new Promise<number>((resolve, reject) => {
        const el = document.createElement("div");
        el.style.cssText = "position:fixed;left:-9999px;width:200px;height:120px";
        document.body.appendChild(el);
        const timeout = setTimeout(() => {
          el.remove();
          reject(new Error("timeout"));
        }, 15000);
        const p = new YT.Player(el, {
          videoId: id,
          width: 200,
          height: 120,
          events: {
            onReady: () => {
              const d = Math.round(p.getDuration());
              clearTimeout(timeout);
              p.destroy();
              el.remove();
              if (d > 0) resolve(d);
              else reject(new Error("no duration"));
            },
            onError: () => {
              clearTimeout(timeout);
              p.destroy();
              el.remove();
              reject(new Error("unavailable"));
            },
          },
        });
      })
  );
}

export default function DebateComposer({
  matchId,
  roundName,
  sideName,
  onPosted,
}: {
  matchId: string;
  roundName: string;
  sideName: string;
  onPosted: () => void;
}) {
  const supabase = createClient();
  const [tab, setTab] = useState<"record" | "upload" | "link">("record");
  const [ready, setReady] = useState<Ready | null>(null);
  const [link, setLink] = useState("");
  const [checking, setChecking] = useState(false);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function tooLong(seconds: number) {
    return `That video is ${formatDuration(seconds)} — debate answers can be at most 3:00. Trim it and try again.`;
  }

  async function checkUpload(url: string | null) {
    setReady(null);
    setError(null);
    if (!url) return;
    setChecking(true);
    try {
      const secs = await readFileDuration(url);
      if (secs > MAX_DEBATE_SECONDS + 2) setError(tooLong(secs));
      else setReady({ type: "upload", url, seconds: Math.min(secs, MAX_DEBATE_SECONDS) });
    } catch {
      setError("We couldn't read that video's length. Try an MP4 or MOV file, or record in the app.");
    } finally {
      setChecking(false);
    }
  }

  async function checkLink() {
    setReady(null);
    setError(null);
    const id = youTubeId(link.trim());
    if (!id) {
      setError("Paste a YouTube link (youtube.com/watch?v=…, youtu.be/…, or a Shorts link).");
      return;
    }
    setChecking(true);
    try {
      const secs = await readYouTubeDuration(id);
      if (secs > MAX_DEBATE_SECONDS + 2) setError(tooLong(secs));
      else setReady({ type: "link", url: `https://www.youtube.com/watch?v=${id}`, seconds: secs });
    } catch {
      setError("That YouTube video can't be embedded — make sure it's Public or Unlisted and embedding is allowed.");
    } finally {
      setChecking(false);
    }
  }

  async function post() {
    if (!ready) return;
    setPosting(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("submit_debate_post", {
      p_match_id: matchId,
      p_source_type: ready.type,
      p_source_url: ready.url,
      p_duration: ready.seconds,
    });
    if (rpcError) {
      setPosting(false);
      setError(rpcError.message);
      return;
    }
    fetch("/api/debates/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId }),
    }).catch(() => {});
    setPosting(false);
    onPosted();
  }

  const tabs: [typeof tab, string][] = [
    ["record", "🎥 Record"],
    ["upload", "⬆️ Upload"],
    ["link", "▶️ YouTube"],
  ];

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--red)", background: "var(--surface)" }}>
      <p className="text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "var(--red)" }}>
        Your turn · {sideName}
      </p>
      <p className="mb-3 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Post your {roundName.toLowerCase()} (max 3:00)
      </p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {tabs.map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setTab(k);
              setReady(null);
              setError(null);
            }}
            className={`bc-chip${tab === k ? " active" : ""}`}
          >
            {l}
          </button>
        ))}
      </div>

      {tab === "record" && (
        <InAppRecorder
          maxSeconds={MAX_DEBATE_SECONDS}
          onRecorded={(url, secs) => {
            setError(null);
            setReady(url ? { type: "record", url, seconds: Math.max(1, Math.min(secs ?? 1, MAX_DEBATE_SECONDS)) } : null);
          }}
        />
      )}
      {tab === "upload" && <FileUploadPicker onUploaded={checkUpload} />}
      {tab === "link" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://youtu.be/…"
            className="flex-1 rounded-[10px] border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          />
          <button
            type="button"
            onClick={checkLink}
            disabled={checking || !link.trim()}
            className="rounded-full border px-4 py-2 text-sm font-bold disabled:opacity-50"
            style={{ borderColor: "var(--border)" }}
          >
            {checking ? "Checking…" : "Check video"}
          </button>
        </div>
      )}

      {checking && tab === "upload" && (
        <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
          Checking the video length…
        </p>
      )}
      {ready && (
        <p className="mt-3 text-sm font-semibold" style={{ color: "var(--text-dim)" }}>
          ✓ Ready — {formatDuration(ready.seconds)} long
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={post}
        disabled={!ready || posting}
        className="bc-btn-solid mt-4 w-full rounded-full px-4 py-3 text-sm font-bold disabled:opacity-50"
      >
        {posting ? "Posting…" : "Post my answer"}
      </button>
      <p className="mt-2 text-center text-[11px]" style={{ color: "var(--text-faint)" }}>
        Once posted, it can&apos;t be changed. Your opponent gets notified that it&apos;s their turn.
      </p>
    </div>
  );
}
