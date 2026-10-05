"use client";

import { useEffect, useRef, useState } from "react";
import InAppRecorder from "@/components/InAppRecorder";
import FileUploadPicker from "@/components/FileUploadPicker";
import { formatDuration, linkDuration } from "@/lib/mediaDuration";

export type ClipSourceValue = {
  sourceType: "upload" | "link" | "record";
  sourceUrl: string | null;
  /** Length in seconds, when known (set when a length cap is in use). */
  seconds?: number | null;
  /** True when a pasted link is known to be longer than the cap. */
  tooLong?: boolean;
};

// Shared upload / record / embed-link clip picker. Used on the Submit page
// (a competitor picking their own clip), in the admin BoutCurator, and for
// Live Vote option speeches (with a 3-minute cap).
export default function ClipSourcePicker({
  value,
  onChange,
  inputClass,
  inputStyle,
  instrumentalUrl,
  maxSeconds,
  uploadPrefix,
}: {
  value: ClipSourceValue;
  onChange: (next: ClipSourceValue) => void;
  inputClass: string;
  inputStyle: React.CSSProperties;
  /** When set, in-app recording plays this beat and mixes it into the clip. */
  instrumentalUrl?: string | null;
  /** Hard length cap: longer uploads are refused, recording stops, links are checked where possible. */
  maxSeconds?: number;
  /** Upload into this storage folder without a signed-in user (candidate links). */
  uploadPrefix?: string;
}) {
  return (
    <div>
      <div
        className="mb-3 inline-flex gap-1 rounded-full p-1"
        style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}
      >
        {(["upload", "link", "record"] as const).map((t) => {
          const active = value.sourceType === t;
          return (
            <button
              key={t}
              type="button"
              onClick={() => onChange(t === value.sourceType ? value : { sourceType: t, sourceUrl: null })}
              className="rounded-full px-3.5 py-1.5 text-sm font-semibold capitalize"
              style={{
                background: active ? "var(--surface)" : "transparent",
                color: active ? "var(--text)" : "var(--text-dim)",
                boxShadow: active ? "inset 0 0 0 1px var(--border)" : "none",
              }}
            >
              {t === "link" ? "Embed link" : t}
            </button>
          );
        })}
      </div>

      {value.sourceType === "link" && (
        <>
          <input
            type="url"
            value={value.sourceUrl ?? ""}
            onChange={(e) => onChange({ sourceType: "link", sourceUrl: e.target.value })}
            placeholder="https://..."
            className={inputClass}
            style={inputStyle}
          />
          {maxSeconds && <LinkLengthCheck value={value} onChange={onChange} maxSeconds={maxSeconds} />}
        </>
      )}

      {value.sourceType === "record" && (
        <InAppRecorder
          instrumentalUrl={instrumentalUrl}
          maxSeconds={maxSeconds}
          uploadPrefix={uploadPrefix}
          onRecorded={(url, secs) => onChange({ sourceType: "record", sourceUrl: url, seconds: secs ?? null })}
        />
      )}

      {value.sourceType === "upload" && (
        <FileUploadPicker
          maxSeconds={maxSeconds}
          mediaOnly={Boolean(maxSeconds)}
          uploadPrefix={uploadPrefix}
          onUploaded={(url, secs) => onChange({ sourceType: "upload", sourceUrl: url, seconds: secs ?? null })}
        />
      )}
    </div>
  );
}

function LinkLengthCheck({
  value,
  onChange,
  maxSeconds,
}: {
  value: ClipSourceValue;
  onChange: (next: ClipSourceValue) => void;
  maxSeconds: number;
}) {
  const url = value.sourceUrl?.trim() ?? "";
  const [result, setResult] = useState<{ url: string; seconds: number | null; site: string } | null>(null);
  const latest = useRef({ value, onChange });
  useEffect(() => {
    latest.current = { value, onChange };
  });

  useEffect(() => {
    if (!/^https:\/\/\S+$/i.test(url)) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await linkDuration(url);
      if (cancelled) return;
      setResult({ url, ...r });
      const { value: v, onChange: change } = latest.current;
      if (v.sourceUrl?.trim() !== url) return;
      change({
        ...v,
        seconds: r.seconds == null ? null : Math.round(r.seconds),
        tooLong: r.seconds != null && r.seconds > maxSeconds + 0.5,
      });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [url, maxSeconds]);

  if (!/^https:\/\/\S+$/i.test(url)) {
    return (
      <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
        {formatDuration(maxSeconds)} max. YouTube and Vimeo lengths are checked automatically.
      </p>
    );
  }
  if (!result || result.url !== url) {
    return (
      <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
        Checking length…
      </p>
    );
  }
  if (result.seconds == null) {
    return (
      <p className="mt-1.5 text-xs" style={{ color: "var(--text-dim)" }}>
        {result.site} doesn&apos;t share video length, so we can&apos;t check it. Keep it under {formatDuration(maxSeconds)}.
      </p>
    );
  }
  const over = result.seconds > maxSeconds + 0.5;
  return (
    <p className="mt-1.5 text-xs font-semibold" style={{ color: over ? "var(--danger)" : "var(--text-dim)" }}>
      {over
        ? `This video is ${formatDuration(result.seconds)} — the limit is ${formatDuration(maxSeconds)}. Use a shorter clip.`
        : `✓ ${formatDuration(result.seconds)} (limit ${formatDuration(maxSeconds)})`}
    </p>
  );
}
