export type ClipSourceTag = {
  label: string;
  icon: string;
  isAudio: boolean;
};

const AUDIO_EXTENSIONS = [".mp3", ".wav", ".m4a", ".ogg", ".flac", ".aac"];

export function getClipSourceTag(
  sourceType: "upload" | "link" | "record" | string,
  sourceUrl: string | null | undefined
): ClipSourceTag {
  if (sourceType === "record") {
    return { label: "Recorded", icon: "🎥", isAudio: false };
  }

  const url = (sourceUrl ?? "").toLowerCase();

  if (url) {
    try {
      const host = new URL(sourceUrl!).hostname.replace(/^www\./, "");
      if (host.includes("youtube.com") || host.includes("youtu.be")) {
        return { label: "YouTube", icon: "▶️", isAudio: false };
      }
      if (host.includes("tiktok.com")) {
        return { label: "TikTok", icon: "🎵", isAudio: false };
      }
      if (host.includes("instagram.com")) {
        return { label: "Instagram", icon: "📸", isAudio: false };
      }
      if (host.includes("vimeo.com")) {
        return { label: "Vimeo", icon: "🎬", isAudio: false };
      }
      if (host.includes("soundcloud.com")) {
        return { label: "SoundCloud", icon: "waveform", isAudio: true };
      }
      if (host.includes("spotify.com")) {
        return { label: "Spotify", icon: "waveform", isAudio: true };
      }
    } catch {
      // not a parseable URL — fall through to extension/type checks
    }

    if (AUDIO_EXTENSIONS.some((ext) => url.endsWith(ext))) {
      return { label: "Audio", icon: "waveform", isAudio: true };
    }
  }

  if (sourceType === "upload") {
    return { label: "Upload", icon: "📁", isAudio: false };
  }

  return { label: "Link", icon: "🔗", isAudio: false };
}


// --- In-app embed support -------------------------------------------------
//
// For a clip submitted as a "link" (rather than uploaded/recorded directly),
// we used to just link out to the original site. Where the platform offers a
// no-API-key embed, we play it inline instead so voters never leave
// BoutCasts to watch a clip.

export type EmbedInfo =
  | { kind: "iframe"; src: string; layout: "video" }
  | { kind: "iframe"; src: string; layout: "audio"; height: number }
  | { kind: "tiktok"; url: string }
  | { kind: "instagram"; url: string };

function extractYouTubeId(u: URL): string | null {
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    return u.pathname.slice(1).split("/")[0] || null;
  }
  if (u.pathname.startsWith("/shorts/")) {
    return u.pathname.split("/")[2] ?? null;
  }
  if (u.pathname.startsWith("/embed/")) {
    return u.pathname.split("/")[2] ?? null;
  }
  return u.searchParams.get("v");
}

export function getEmbedInfo(sourceUrl: string | null | undefined): EmbedInfo | null {
  if (!sourceUrl) return null;

  let u: URL;
  try {
    u = new URL(sourceUrl);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");

  if (host.includes("youtube.com") || host === "youtu.be") {
    const id = extractYouTubeId(u);
    return id ? { kind: "iframe", src: `https://www.youtube.com/embed/${id}`, layout: "video" } : null;
  }

  if (host.includes("vimeo.com")) {
    const match = u.pathname.match(/(\d+)/);
    return match ? { kind: "iframe", src: `https://player.vimeo.com/video/${match[1]}`, layout: "video" } : null;
  }

  if (host.includes("soundcloud.com")) {
    return {
      kind: "iframe",
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(sourceUrl)}&color=%23ff3b30&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false`,
      layout: "audio",
      height: 166,
    };
  }

  if (host.includes("spotify.com")) {
    const match = u.pathname.match(/\/(track|episode|album|playlist|show)\/([A-Za-z0-9]+)/);
    return match
      ? { kind: "iframe", src: `https://open.spotify.com/embed/${match[1]}/${match[2]}`, layout: "audio", height: 152 }
      : null;
  }

  if (host.includes("tiktok.com")) {
    return { kind: "tiktok", url: sourceUrl };
  }

  if (host.includes("instagram.com")) {
    return { kind: "instagram", url: sourceUrl };
  }

  return null;
}
