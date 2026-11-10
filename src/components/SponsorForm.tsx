"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import ImageField from "@/components/ImageField";
import { normLink, sponsorError, type LibrarySponsor } from "@/lib/sponsors";

// Create or edit a sponsor in the library: name, logo, website, and an optional commercial
// (a video link such as YouTube, or a picture) that can be switched on per placement.
export default function SponsorForm({
  sponsor,
  onSaved,
  onCancel,
  submitLabel,
}: {
  sponsor?: LibrarySponsor;
  onSaved: (s: LibrarySponsor) => void;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [name, setName] = useState(sponsor?.name ?? "");
  const [link, setLink] = useState(sponsor?.link_url ?? "");
  const [logo, setLogo] = useState<string | null>(sponsor?.logo_url ?? null);
  const [kind, setKind] = useState<"video" | "image">(sponsor?.commercial_kind ?? "video");
  const [cUrl, setCUrl] = useState(sponsor?.commercial_url ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withCommercial, setWithCommercial] = useState(!!sponsor?.commercial_url);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const row = {
      name: name.trim(),
      logo_url: logo,
      link_url: normLink(link),
      commercial_url: withCommercial && cUrl.trim() ? cUrl.trim() : null,
      commercial_kind: withCommercial && cUrl.trim() ? kind : null,
    };
    const sb = createClient();
    const { data, error: err } = sponsor
      ? await sb.from("sponsor_library").update(row).eq("id", sponsor.id).select("id,name,logo_url,link_url,commercial_url,commercial_kind").single()
      : await sb.from("sponsor_library").insert(row).select("id,name,logo_url,link_url,commercial_url,commercial_kind").single();
    setBusy(false);
    if (err || !data) {
      setError(sponsorError(err?.message ?? "Couldn't save."));
      return;
    }
    onSaved(data as LibrarySponsor);
  }

  const box = { borderColor: "var(--border)" };
  const input = "w-full rounded-lg border px-3 py-2 text-sm";
  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <input className={input} style={box} placeholder="Sponsor name (e.g. Main Street Pizza)" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} required />
      <input className={input} style={box} placeholder="Website (optional)" value={link} onChange={(e) => setLink(e.target.value)} />
      <ImageField value={logo} onChange={setLogo} label="sponsor logo" />
      <label className="mt-1 flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" checked={withCommercial} onChange={(e) => setWithCommercial(e.target.checked)} />
        <span>
          <span className="font-semibold">Commercial add-on</span>
          <span className="block text-xs opacity-70">A short video link or picture this sponsor can show. You choose where it plays on each placement.</span>
        </span>
      </label>
      {withCommercial && (
        <div className="flex flex-col gap-2 rounded-lg border p-3" style={box}>
          <div className="flex gap-2 text-sm">
            <button type="button" onClick={() => setKind("video")} className="rounded-full border px-3 py-1 font-semibold" style={{ ...box, background: kind === "video" ? "#1b4fe4" : "transparent", color: kind === "video" ? "#fff" : undefined }}>Video link</button>
            <button type="button" onClick={() => setKind("image")} className="rounded-full border px-3 py-1 font-semibold" style={{ ...box, background: kind === "image" ? "#1b4fe4" : "transparent", color: kind === "image" ? "#fff" : undefined }}>Picture</button>
          </div>
          {kind === "video" ? (
            <input className={input} style={box} placeholder="https:// link to the commercial (YouTube, Vimeo, …)" value={cUrl} onChange={(e) => setCUrl(e.target.value)} />
          ) : (
            <ImageField value={cUrl || null} onChange={(v) => setCUrl(v ?? "")} label="commercial" wide />
          )}
        </div>
      )}
      {error && <p role="alert" className="text-xs font-semibold" style={{ color: "var(--danger)" }}>{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !name.trim()} className="rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60" style={{ background: "#1b4fe4" }}>
          {busy ? "Saving…" : submitLabel ?? (sponsor ? "Save sponsor" : "Add sponsor")}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="rounded-full border px-4 py-2.5 text-sm font-semibold" style={box}>Cancel</button>}
      </div>
    </form>
  );
}
