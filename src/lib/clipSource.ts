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
