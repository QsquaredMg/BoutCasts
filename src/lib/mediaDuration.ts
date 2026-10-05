import { getEmbedInfo } from "@/lib/clipSource";

// How long is a video? Used to enforce the 3-minute cap on Live Vote speeches.
// Files are read in the browser; YouTube through its player API; Vimeo through
// its public oEmbed. TikTok / Instagram don't expose length, so those return null.

export const SPEECH_MAX_SECONDS = 180;

export function formatDuration(seconds: number) {
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function mediaElementDuration(src: string, timeoutMs = 15_000): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement("video");
    el.preload = "metadata";
    el.muted = true;
    let done = false;
    const finish = (v: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.removeAttribute("src");
      el.load();
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    el.onloadedmetadata = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) return finish(el.duration);
      // Some recordings (WebM) report Infinity until you seek to the end.
      el.ontimeupdate = () => {
        if (Number.isFinite(el.duration) && el.duration > 0) finish(el.duration);
      };
      try {
        el.currentTime = 1e9;
      } catch {
        finish(null);
      }
    };
    el.onerror = () => finish(null);
    el.src = src;
  });
}

/** Length of a picked video/audio file in seconds, or null if this browser can't tell. */
export async function fileDuration(file: Blob): Promise<number | null> {
  const url = URL.createObjectURL(file);
  try {
    return await mediaElementDuration(url);
  } finally {
    URL.revokeObjectURL(url);
  }
}

type YTPlayer = { getDuration(): number; destroy(): void };
type YTNamespace = { Player: new (el: HTMLElement, opts: Record<string, unknown>) => YTPlayer };

let ytApi: Promise<YTNamespace> | null = null;
function loadYouTubeApi(): Promise<YTNamespace> {
  const w = window as unknown as { YT?: YTNamespace & { loaded?: number }; onYouTubeIframeAPIReady?: () => void };
  if (w.YT?.Player) return Promise.resolve(w.YT);
  if (!ytApi) {
    ytApi = new Promise((resolve, reject) => {
      const prev = w.onYouTubeIframeAPIReady;
      w.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(w.YT!);
      };
      const s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      s.async = true;
      s.onerror = () => {
        ytApi = null;
        reject(new Error("youtube api"));
      };
      document.head.appendChild(s);
    });
  }
  return ytApi;
}

async function youTubeDuration(videoId: string): Promise<number | null> {
  let YT: YTNamespace;
  try {
    YT = await loadYouTubeApi();
  } catch {
    return null;
  }
  return new Promise((resolve) => {
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:-9999px;top:0;width:200px;height:120px;opacity:0;pointer-events:none";
    const inner = document.createElement("div");
    host.appendChild(inner);
    document.body.appendChild(host);
    let player: YTPlayer | null = null;
    let done = false;
    const finish = (v: number | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearInterval(poll);
      try {
        player?.destroy();
      } catch {}
      host.remove();
      resolve(v);
    };
    const timer = setTimeout(() => finish(null), 12_000);
    let poll: ReturnType<typeof setInterval> | undefined;
    player = new YT.Player(inner, {
      videoId,
      width: 200,
      height: 120,
      playerVars: { autoplay: 0, controls: 0 },
      events: {
        onReady: () => {
          const read = () => {
            const d = player?.getDuration() ?? 0;
            if (d > 0) finish(d);
          };
          read();
          poll = setInterval(read, 250);
        },
        onError: () => finish(null),
      },
    });
  });
}

async function vimeoDuration(url: string): Promise<number | null> {
  try {
    const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const j = (await res.json()) as { duration?: number };
    return typeof j.duration === "number" && j.duration > 0 ? j.duration : null;
  } catch {
    return null;
  }
}

/**
 * Length of a pasted link, when it can be read.
 * Returns { seconds } or { seconds: null, reason } when the site doesn't say.
 */
export async function linkDuration(url: string): Promise<{ seconds: number | null; site: string }> {
  const info = getEmbedInfo(url);
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return { seconds: null, site: "link" };
  }
  if (info?.kind === "iframe" && info.src.includes("youtube.com/embed/")) {
    const id = info.src.split("/embed/")[1]?.split(/[?&]/)[0];
    return { seconds: id ? await youTubeDuration(id) : null, site: "YouTube" };
  }
  if (host.includes("vimeo.com")) return { seconds: await vimeoDuration(url), site: "Vimeo" };
  if (host.includes("tiktok.com")) return { seconds: null, site: "TikTok" };
  if (host.includes("instagram.com")) return { seconds: null, site: "Instagram" };
  if (/\.(mp4|mov|webm|m4v|mp3|m4a|wav)(\?|$)/i.test(url)) return { seconds: await mediaElementDuration(url), site: "video file" };
  return { seconds: null, site: host || "link" };
}
