"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const LICENSES = [
  { value: "original", label: "Original — I made it" },
  { value: "royalty_free", label: "Royalty-free (I'll add the source link)" },
  { value: "licensed_to_boutcasts", label: "Licensed to BoutCasts" },
] as const;

const ACCEPT = "audio/mpeg,audio/wav,audio/x-wav,audio/mp4";
const MAX_BYTES = 50 * 1024 * 1024;

// Staff and organizers upload an instrumental. It enters as "pending" and an
// admin approves it (phase 1 SQL leaves the approval step to the admin UI/SQL).
export default function InstrumentalUpload({ onDone }: { onDone?: () => void }) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [producer, setProducer] = useState("");
  const [bpm, setBpm] = useState("");
  const [musicalKey, setMusicalKey] = useState("");
  const [genre, setGenre] = useState("");
  const [license, setLicense] = useState<(typeof LICENSES)[number]["value"]>("original");
  const [sourceUrl, setSourceUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) return setError("Choose an audio file.");
    if (file.size > MAX_BYTES) return setError("File is larger than 50 MB.");
    if (!agree) return setError("Please accept the instrumental license terms.");
    if (license === "royalty_free" && !sourceUrl.trim()) return setError("Add the royalty-free source link.");

    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setBusy(false);
      setError("Please sign in to upload.");
      return;
    }

    const ext = file.name.split(".").pop() || "mp3";
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from("instrumentals")
      .upload(path, file, { contentType: file.type || undefined });
    if (uploadError) {
      setBusy(false);
      return setError(uploadError.message);
    }
    const { data: urlData } = supabase.storage.from("instrumentals").getPublicUrl(path);

    const { error: insertError } = await supabase.from("instrumentals").insert({
      title: title.trim(),
      producer_name: producer.trim(),
      file_url: urlData.publicUrl,
      bpm: bpm ? Number(bpm) : null,
      musical_key: musicalKey.trim() || null,
      genre: genre.trim() || null,
      license_type: license,
      license_source_url: sourceUrl.trim() || null,
      status: "pending",
      uploaded_by: user.id,
    });
    setBusy(false);
    if (insertError) return setError(insertError.message);
    setDone(true);
    onDone?.();
  }

  const input = "rounded border border-neutral-300 px-3 py-2 text-sm";

  if (done) {
    return <p className="text-sm font-medium">Instrumental submitted. It will appear once it is approved.</p>;
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Track title" className={input} />
      <input required value={producer} onChange={(e) => setProducer(e.target.value)} placeholder="Producer name (credited on bouts)" className={input} />
      <div className="flex gap-3">
        <input value={bpm} onChange={(e) => setBpm(e.target.value)} placeholder="BPM" inputMode="numeric" className={`${input} w-24`} />
        <input value={musicalKey} onChange={(e) => setMusicalKey(e.target.value)} placeholder="Key (e.g. A minor)" className={`${input} flex-1`} />
        <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genre" className={`${input} flex-1`} />
      </div>
      <select value={license} onChange={(e) => setLicense(e.target.value as typeof license)} className={input}>
        {LICENSES.map((l) => (
          <option key={l.value} value={l.value}>{l.label}</option>
        ))}
      </select>
      {license === "royalty_free" && (
        <input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Link to the license or source" className={input} />
      )}
      <input type="file" accept={ACCEPT} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-sm" />
      <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5" />
        <span>
          I own or have the rights to this track and grant BoutCasts a non-exclusive license to host it and let
          performers use it in battles, with credit to the producer. No ripped or copyrighted beats.
        </span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={busy} className="self-start rounded bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? "Uploading..." : "Submit instrumental"}
      </button>
    </form>
  );
}
