import { getClipSourceTag, getEmbedInfo } from "@/lib/clipSource";

// How to show a Live Vote option's clip: our own hosted file, an embeddable
// link (YouTube etc.), or a plain outbound link.
export function displayClip(option: { source_type: string; source_url: string | null }) {
  if (!option.source_url) return null;
  if (option.source_type === "upload" || option.source_type === "record") {
    return {
      kind: "hosted" as const,
      url: option.source_url,
      isAudio: getClipSourceTag(option.source_type, option.source_url).isAudio,
    };
  }
  if (option.source_type === "link" && getEmbedInfo(option.source_url)) {
    return { kind: "embed" as const, url: option.source_url };
  }
  return { kind: "link" as const, url: option.source_url };
}
