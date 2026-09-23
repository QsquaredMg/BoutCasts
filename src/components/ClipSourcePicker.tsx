"use client";

import InAppRecorder from "@/components/InAppRecorder";
import FileUploadPicker from "@/components/FileUploadPicker";

export type ClipSourceValue = {
  sourceType: "upload" | "link" | "record";
  sourceUrl: string | null;
};

// Shared upload / record / embed-link clip picker. Used on the Submit page
// (a competitor picking their own clip) and in the admin BoutCurator (an
// admin attaching a clip directly to either side of a closed bout).
export default function ClipSourcePicker({
  value,
  onChange,
  inputClass,
  inputStyle,
}: {
  value: ClipSourceValue;
  onChange: (next: ClipSourceValue) => void;
  inputClass: string;
  inputStyle: React.CSSProperties;
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
              onClick={() => onChange({ sourceType: t, sourceUrl: t === value.sourceType ? value.sourceUrl : null })}
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
        <input
          type="url"
          value={value.sourceUrl ?? ""}
          onChange={(e) => onChange({ sourceType: "link", sourceUrl: e.target.value })}
          placeholder="https://..."
          className={inputClass}
          style={inputStyle}
        />
      )}

      {value.sourceType === "record" && (
        <InAppRecorder onRecorded={(url) => onChange({ sourceType: "record", sourceUrl: url })} />
      )}

      {value.sourceType === "upload" && (
        <FileUploadPicker onUploaded={(url) => onChange({ sourceType: "upload", sourceUrl: url })} />
      )}
    </div>
  );
}
