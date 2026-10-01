import type { Instrumental } from "@/lib/types";

// Shows the shared instrumental for a music bout so voters can hear what both
// performers used, and performers can download it. Server component.
export default function InstrumentalPlayer({ instrumental }: { instrumental: Instrumental }) {
  const details = [
    instrumental.bpm ? `${instrumental.bpm} BPM` : null,
    instrumental.musical_key,
    instrumental.genre,
  ].filter(Boolean);

  return (
    <div
      className="mb-5 rounded-xl border p-3 text-sm"
      style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
    >
      <div className="mb-1 font-bold" style={{ fontFamily: "var(--font-display)" }}>
        🎧 Same instrumental for both: {instrumental.title}
      </div>
      <div className="mb-2 text-xs" style={{ color: "var(--text-faint)" }}>
        Produced by {instrumental.producer_name}
        {details.length > 0 ? ` · ${details.join(" · ")}` : ""}
      </div>
      <audio src={instrumental.file_url} controls preload="none" className="w-full" />
      <a
        href={instrumental.file_url}
        download
        className="mt-2 inline-block text-xs font-semibold underline"
        style={{ color: "var(--blue)" }}
      >
        Download to perform over it
      </a>
    </div>
  );
}
