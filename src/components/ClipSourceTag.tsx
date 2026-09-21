import { getClipSourceTag } from "@/lib/clipSource";

function WaveformIcon() {
  const heights = [4, 9, 6, 11, 5, 8];
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" className="inline-block">
      {heights.map((h, i) => (
        <rect
          key={i}
          x={i * 2.3}
          y={(12 - h) / 2}
          width="1.4"
          height={h}
          rx="0.7"
          fill="currentColor"
        />
      ))}
    </svg>
  );
}

export default function ClipSourceTag({
  sourceType,
  sourceUrl,
}: {
  sourceType: string;
  sourceUrl: string | null | undefined;
}) {
  const tag = getClipSourceTag(sourceType, sourceUrl);

  const content = (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
      style={{
        background: tag.isAudio ? "var(--blue-soft)" : "var(--surface-2)",
        color: tag.isAudio ? "var(--blue)" : "var(--text-dim)",
      }}
    >
      {tag.icon === "waveform" ? <WaveformIcon /> : <span>{tag.icon}</span>}
      {tag.label}
    </span>
  );

  if (sourceUrl && (sourceType === "link" || sourceType === "upload")) {
    return (
      <a href={sourceUrl} target="_blank" rel="noreferrer" className="hover:opacity-80">
        {content}
      </a>
    );
  }

  return content;
}
