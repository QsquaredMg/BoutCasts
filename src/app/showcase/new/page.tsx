"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import FileUploadPicker from "@/components/FileUploadPicker";
import LogoUploadField from "@/components/LogoUploadField";
import TeamPicker from "@/components/TeamPicker";
import { normalizeEmbedInput } from "@/lib/clipSource";
import { parseClock, type ShowcaseKind } from "@/lib/showcases";
import ZonedDateTimeInput from "@/components/ZonedDateTimeInput";
import { getZone } from "@/lib/time/pref";
import { wallToIso } from "@/lib/time/zones";

type Category = { id: string; name: string };
type Sub = { id: string; name: string; category_id: string };
type ChoiceDraft = { name: string; team_name: string; image_url: string; start: string };

const blank = (): ChoiceDraft => ({ name: "", team_name: "", image_url: "", start: "" });

export default function NewShowcasePage() {
  const supabase = createClient();
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [kind, setKind] = useState<ShowcaseKind>("bout");
  const [cats, setCats] = useState<Category[]>([]);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [videoTab, setVideoTab] = useState<"upload" | "link">("link");
  const [uploadUrl, setUploadUrl] = useState<string | null>(null);
  const [link, setLink] = useState("");
  const [choices, setChoices] = useState<ChoiceDraft[]>([blank(), blank(), blank()]);
  const [scoring, setScoring] = useState<"crowd" | "judges" | "both">("crowd");
  const [crowdWeight, setCrowdWeight] = useState(50);
  const [hideTally, setHideTally] = useState(false);
  const [closesAt, setClosesAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const k = new URLSearchParams(window.location.search).get("kind");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (k === "debate") setKind("debate");
    async function init() {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return setAllowed(false);
      const [{ data: p }, { data: c }, { data: s }] = await Promise.all([
        supabase.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle(),
        supabase.from("categories").select("id, name").order("name"),
        supabase.from("subcategories").select("id, name, category_id").order("name"),
      ]);
      setAllowed(Boolean(p?.is_admin));
      setCats(c ?? []);
      setSubs(s ?? []);
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(i: number, patch: Partial<ChoiceDraft>) {
    setChoices((prev) => prev.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const videoUrl = videoTab === "upload" ? uploadUrl : normalizeEmbedInput(link.trim());
    if (!videoUrl) return setError(videoTab === "upload" ? "Upload the video first." : "Paste a YouTube (or other supported) video link.");
    const filled = choices.filter((c) => c.name.trim());
    if (filled.length < 2) return setError(`Add at least 2 ${kind === "debate" ? "debaters" : "groups"}.`);
    const parsed = [];
    for (const c of filled) {
      const t = parseClock(c.start);
      if (Number.isNaN(t)) return setError(`"${c.name}": start time should look like 4:15 or 1:02:30.`);
      parsed.push({ name: c.name.trim(), team_name: c.team_name.trim(), image_url: c.image_url || null, start_seconds: t });
    }
    setSaving(true);
    const { data, error: rpcError } = await supabase.rpc("create_showcase", {
      p_kind: kind,
      p_title: title,
      p_description: description,
      p_category_id: categoryId || null,
      p_subcategory_id: subcategoryId || null,
      p_source_type: videoTab === "upload" ? "upload" : "link",
      p_source_url: videoUrl,
      p_scoring_mode: scoring,
      p_crowd_weight: crowdWeight,
      p_hide_tally: hideTally,
      p_closes_at: closesAt ? wallToIso(closesAt, getZone()) : null,
      p_choices: parsed,
    });
    setSaving(false);
    if (rpcError) return setError(rpcError.message);
    router.push(`/showcase/${data}`);
  }

  if (allowed === null) return <p className="mx-auto max-w-2xl px-5 py-10" style={{ color: "var(--text-faint)" }}>Loading…</p>;
  if (!allowed)
    return (
      <p className="mx-auto max-w-2xl px-5 py-10" style={{ color: "var(--text-faint)" }}>
        Only admins can create showcases. Organizers can use &ldquo;One video for all options&rdquo; when creating a{" "}
        <Link href="/live-vote/new" className="underline">
          Live Vote
        </Link>
        .
      </p>
    );

  const input = "w-full rounded-[10px] border px-3 py-2.5 text-sm";
  const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };
  const label = "mb-1 block text-xs font-bold uppercase tracking-wide";
  const chip = (a: boolean) => `bc-chip${a ? " active" : ""}`;
  const who = kind === "debate" ? "debater" : "group";

  return (
    <form onSubmit={create} className="mx-auto flex max-w-xl flex-col gap-5 px-5 py-8">
      <div>
        <h1 className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          New {kind === "debate" ? "panel debate" : "showcase"}
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
          One video, many choices — voters watch once and pick their favorite {who}.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={chip(kind === "bout")} onClick={() => setKind("bout")}>
          Showcase bout (groups, teams, performers)
        </button>
        <button type="button" className={chip(kind === "debate")} onClick={() => setKind("debate")}>
          Panel debate (several debaters)
        </button>
      </div>

      <div>
        <label className={label} style={{ color: "var(--text-dim)" }}>
          Title
        </label>
        <input required minLength={3} maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "debate" ? "Panel: Should phones be banned in school?" : "Homecoming Dance-Off 2026"} className={input} style={inputStyle} />
      </div>
      <div>
        <label className={label} style={{ color: "var(--text-dim)" }}>
          Details (optional)
        </label>
        <textarea maxLength={2000} rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className={input} style={inputStyle} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={label} style={{ color: "var(--text-dim)" }}>
            Category
          </label>
          <select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(""); }} className={input} style={inputStyle}>
            <option value="">None</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={label} style={{ color: "var(--text-dim)" }}>
            Subcategory
          </label>
          <select value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)} disabled={!categoryId} className={input} style={inputStyle}>
            <option value="">None</option>
            {subs.filter((s) => s.category_id === categoryId).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <p className={label} style={{ color: "var(--text-dim)" }}>
          The one video
        </p>
        <div className="mb-2 flex gap-2">
          <button type="button" className={chip(videoTab === "link")} onClick={() => setVideoTab("link")}>YouTube / link</button>
          <button type="button" className={chip(videoTab === "upload")} onClick={() => setVideoTab("upload")}>Upload</button>
        </div>
        {videoTab === "link" ? (
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://youtu.be/…" className={input} style={inputStyle} />
        ) : (
          <FileUploadPicker onUploaded={setUploadUrl} />
        )}
      </div>

      <div>
        <p className={label} style={{ color: "var(--text-dim)" }}>
          {kind === "debate" ? "Debaters" : "Groups"} ({choices.filter((c) => c.name.trim()).length} of up to 16)
        </p>
        <div className="flex flex-col gap-3">
          {choices.map((c, i) => (
            <div key={i} className="rounded-xl border p-3" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: "var(--text-faint)" }}>#{i + 1}</span>
                {choices.length > 2 && (
                  <button type="button" onClick={() => setChoices((p) => p.filter((_, j) => j !== i))} className="text-xs" style={{ color: "var(--text-faint)" }}>
                    Remove
                  </button>
                )}
              </div>
              <TeamPicker label="Pick a team or school" nameMode="full" onPick={(p) => update(i, { team_name: p.name, image_url: p.logo, name: c.name || p.name })} />
              <div className="grid gap-2 sm:grid-cols-2">
                <input value={c.name} onChange={(e) => update(i, { name: e.target.value })} maxLength={80} placeholder={kind === "debate" ? "Debater name" : "Group / performer name"} className={input} style={inputStyle} />
                <input value={c.team_name} onChange={(e) => update(i, { team_name: e.target.value })} maxLength={80} placeholder={kind === "debate" ? "School / team (optional)" : "Team / school (optional)"} className={input} style={inputStyle} />
              </div>
              <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_130px]">
                <LogoUploadField value={c.image_url} onChange={(url) => update(i, { image_url: url })} folder="teams" compact />
                <input value={c.start} onChange={(e) => update(i, { start: e.target.value })} placeholder="Starts at 4:15" className={input} style={inputStyle} />
              </div>
            </div>
          ))}
        </div>
        {choices.length < 16 && (
          <button type="button" onClick={() => setChoices((p) => [...p, blank()])} className="mt-2 rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }}>
            + Add {who}
          </button>
        )}
        <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
          Logo or picture and start time are optional. The start time lets voters jump straight to that {who}&apos;s part.
        </p>
      </div>

      <div>
        <p className={label} style={{ color: "var(--text-dim)" }}>
          Who decides
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={chip(scoring === "crowd")} onClick={() => setScoring("crowd")}>Crowd vote</button>
          <button type="button" className={chip(scoring === "judges")} onClick={() => setScoring("judges")}>Judges</button>
          <button type="button" className={chip(scoring === "both")} onClick={() => setScoring("both")}>Both</button>
        </div>
        {scoring === "both" && (
          <label className="mt-2 block text-sm">
            Crowd {crowdWeight}% · Judges {100 - crowdWeight}%
            <input type="range" min={10} max={90} step={10} value={crowdWeight} onChange={(e) => setCrowdWeight(Number(e.target.value))} className="mt-1 w-full accent-[var(--red)]" />
          </label>
        )}
        {scoring !== "crowd" && (
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
            Add judges on the page after you create it. They score each {who} 1–10 on four criteria.
          </p>
        )}
      </div>

      <div>
        <label className={label} style={{ color: "var(--text-dim)" }}>
          Voting closes (optional — leave empty to close it yourself)
        </label>
        <ZonedDateTimeInput value={closesAt} onChange={setClosesAt} className={input} style={inputStyle} />
      </div>
      <label className="flex cursor-pointer items-center gap-2.5 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-[var(--red)]" checked={hideTally} onChange={(e) => setHideTally(e.target.checked)} />
        Hide vote counts until voting closes
      </label>

      {error && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
      <button type="submit" disabled={saving || title.trim().length < 3} className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-50">
        {saving ? "Creating…" : "Create and open voting"}
      </button>
    </form>
  );
}
