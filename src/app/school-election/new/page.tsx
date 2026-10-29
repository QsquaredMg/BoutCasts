"use client";

import { normalizeVideoLink } from "@/lib/clipSource";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import SignInCard from "@/components/SignInCard";
import ImageField from "@/components/ImageField";
import FileUploadPicker from "@/components/FileUploadPicker";
import { createClient } from "@/lib/supabase/client";
import { LIVE_VOTE_TIERS, SCHOOL_ELECTION, ORG_LICENSE, schoolElectionPriceCents, type LiveVoteTier } from "@/lib/liveVoteEvents/tiers";

type Cand = { key: string; name: string; description: string; photoUrl: string | null; videoUrl: string | null; videoSeconds: number | null; videoLink: string };
type RaceDraft = { key: string; title: string; candidates: Cand[] };

const k = () => Math.random().toString(36).slice(2);
const newCand = (): Cand => ({ key: k(), name: "", description: "", photoUrl: null, videoUrl: null, videoSeconds: null, videoLink: "" });
const newRace = (): RaceDraft => ({ key: k(), title: "", candidates: [newCand(), newCand()] });
const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export default function NewSchoolElectionPage() {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [title, setTitle] = useState("");
  const [school, setSchool] = useState("");
  const [tier, setTier] = useState<LiveVoteTier>("small");
  const [kiosks, setKiosks] = useState(1);
  const [days, setDays] = useState(1);
  const [pin, setPin] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [bgImage, setBgImage] = useState<string | null>(null);
  const [accent, setAccent] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState<string | null>(null);
  const [showTally, setShowTally] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openEnded, setOpenEnded] = useState(false);
  const [practice, setPractice] = useState(false);
  const [races, setRaces] = useState<RaceDraft[]>([{ ...newRace(), title: "President" }]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const sb = createClient();
    sb.auth.getUser().then(async ({ data }) => {
      setSignedIn(!!data.user);
      if (data.user) {
        const { data: me } = await sb.from("profiles").select("is_admin").eq("id", data.user.id).maybeSingle();
        setIsAdmin(!!me?.is_admin);
      }
    });
  }, []);

  const price = practice ? 0 : schoolElectionPriceCents(tier, kiosks, days);
  const input = "w-full rounded-[10px] border px-3 py-2.5 text-sm";
  const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" } as const;

  function patchRace(key: string, fn: (r: RaceDraft) => RaceDraft) {
    setRaces((rs) => rs.map((r) => (r.key === key ? fn(r) : r)));
  }

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/school-election", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          schoolName: school,
          tier,
          kiosks,
          days,
          pin,
          brandLogoUrl: logo,
          coverImageUrl: banner,
          brandBgImageUrl: bgImage,
          brandColor: accent,
          brandBgColor: bgColor,
          showTally,
          openEnded: isAdmin && openEnded,
          practice,
          races: races.map((r) => ({ title: r.title, candidates: r.candidates.map((c) => ({ name: c.name, description: c.description, photoUrl: c.photoUrl, videoUrl: c.videoUrl, videoSeconds: c.videoSeconds, videoLink: c.videoLink })) })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't create the election.");
      router.push(`/school-election/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't create the election.");
      setBusy(false);
    }
  }

  if (signedIn === null) return <div className="mx-auto max-w-3xl px-5 py-10 text-sm">Loading…</div>;
  if (!signedIn) {
    return (
      <SignInCard
        eyebrow="School elections"
        title="Sign in to run a school election"
        body="Set up a ballot, load your roster and run voting from iPads at a booth."
        next="/school-election/new"
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="text-3xl font-extrabold">New school election</h1>
      <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
        One ballot with several offices. Students vote at a kiosk (an iPad at a booth) with a code a teacher hands them. Results stay hidden until voting closes.
      </p>
      <p className="mt-2 rounded-xl p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
        You are buying this election on its own, with no license needed. Running several votes a year? The{" "}
        <a href="/org" className="font-bold underline">School &amp; League License</a> covers them all for ${ORG_LICENSE.priceCents / 100}/year.
      </p>

      <section className="mt-6 grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">
          Election name
          <input className={input} style={inputStyle} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Student council 2026" />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          School name (optional)
          <input className={input} style={inputStyle} value={school} maxLength={120} onChange={(e) => setSchool(e.target.value)} placeholder="JC High School" />
        </label>
      </section>

      <section className="mt-6 grid gap-3">
        <p className="text-sm font-bold">Your school&apos;s look</p>
        <p className="-mt-2 text-xs" style={{ color: "var(--text-faint)" }}>Used on every page of this election: the organizer pages, the booth desk, the iPad kiosk and the winners graphic.</p>
        <div className="grid gap-1 text-sm font-semibold">School logo<ImageField value={logo} onChange={setLogo} label="logo" /></div>
        <div className="grid gap-1 text-sm font-semibold">Banner<ImageField value={banner} onChange={setBanner} label="banner" wide /></div>
        <div className="grid gap-1 text-sm font-semibold">Background photo (optional)<ImageField value={bgImage} onChange={setBgImage} label="background photo" wide /></div>
        <div className="grid grid-cols-2 gap-3">
          {([["School color", accent, setAccent, "#2352E8"], ["Page background", bgColor, setBgColor, "#f6f4ef"]] as const).map(([label, value, set, fb]) => (
            <label key={label} className="grid gap-1 text-sm font-semibold">{label}
              <span className="flex items-center gap-2">
                <input type="color" value={value ?? fb} onChange={(e) => set(e.target.value)} className="h-10 w-12 cursor-pointer rounded-md border" style={{ borderColor: "var(--border)" }} />
                {value ? <button type="button" onClick={() => set(null)} className="text-xs font-semibold" style={{ color: "var(--text-faint)" }}>Reset</button> : <span className="text-xs font-normal" style={{ color: "var(--text-faint)" }}>Default</span>}
              </span>
            </label>
          ))}
        </div>
        {isAdmin && (
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={openEnded} onChange={(e) => setOpenEnded(e.target.checked)} className="mt-1" />
            <span><span className="font-semibold">Admin: no end time.</span> <span style={{ color: "var(--text-faint)" }}>Stays open until you close it by hand. Good for polls ahead of an election and for test or example ballots. Admins can preview the running count.</span></span>
          </label>
        )}
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={practice} onChange={(e) => { setPractice(e.target.checked); if (e.target.checked) { setTier("free"); setKiosks(1); setDays(1); } }} className="mt-1" />
          <span><span className="font-semibold">This is a practice election.</span> <span style={{ color: "var(--text-faint)" }}>Free, one kiosk, and you can reset it and run it again as often as you like. Use it to rehearse with a class before the real vote. It can&apos;t raise money or be certified.</span></span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={showTally} onChange={(e) => setShowTally(e.target.checked)} className="mt-1" />
          <span><span className="font-semibold">Show vote counts in the results.</span> <span style={{ color: "var(--text-faint)" }}>Turn off to show only the winners.</span></span>
        </label>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Size</h2>
        <div className="grid gap-2 sm:grid-cols-4">
          {SCHOOL_ELECTION.tiers.map((t) => {
            const cfg = LIVE_VOTE_TIERS[t];
            const active = tier === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTier(t)}
                className="rounded-[10px] border px-3 py-2.5 text-left"
                style={{ borderColor: active ? "var(--red)" : "var(--border)", background: active ? "var(--red-soft, var(--surface-2))" : "var(--surface)" }}
              >
                <p className="text-sm font-bold">{cfg.label} · {cfg.priceCents ? dollars(cfg.priceCents) : "Free"}</p>
                <p className="text-xs" style={{ color: "var(--text-faint)" }}>Up to {cfg.voteCap.toLocaleString()} students</p>
              </button>
            );
          })}
        </div>
        <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>The price includes 1 kiosk and the first day of voting. A Free election runs 12 hours.</p>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Kiosks (iPads)</h2>
          <div className="flex gap-2">
            {Array.from({ length: SCHOOL_ELECTION.maxKiosks }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => setKiosks(n)} className="flex-1 rounded-[10px] border px-3 py-2 text-sm font-bold"
                style={{ borderColor: kiosks === n ? "var(--red)" : "var(--border)", background: kiosks === n ? "var(--red-soft, var(--surface-2))" : "var(--surface)" }}>
                {n}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>First kiosk included, +{dollars(SCHOOL_ELECTION.extraKioskCents)} for each extra.</p>
        </div>
        <div>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Days of voting</h2>
          <div className="flex gap-2">
            {Array.from({ length: SCHOOL_ELECTION.maxDays }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" onClick={() => setDays(n)} className="flex-1 rounded-[10px] border px-3 py-2 text-sm font-bold"
                style={{ borderColor: days === n ? "var(--red)" : "var(--border)", background: days === n ? "var(--red-soft, var(--surface-2))" : "var(--surface)" }}>
                {n}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>First day included, +{dollars(SCHOOL_ELECTION.extraDayCents)} for each extra.</p>
        </div>
      </section>

      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>Offices and candidates</h2>
        <div className="grid gap-4">
          {races.map((r, ri) => (
            <div key={r.key} className="rounded-xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <div className="flex gap-2">
                <input className={input} style={inputStyle} value={r.title} maxLength={120} placeholder={`Office ${ri + 1} (e.g. President)`} onChange={(e) => patchRace(r.key, (x) => ({ ...x, title: e.target.value }))} />
                {races.length > 1 && (
                  <button type="button" className="rounded-full border px-3 text-xs font-bold" style={{ borderColor: "var(--border)" }} onClick={() => setRaces((rs) => rs.filter((x) => x.key !== r.key))}>Remove</button>
                )}
              </div>
              <div className="mt-2 grid gap-2">
                {r.candidates.map((c, ci) => (
                  <div key={c.key} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
                    <input className={input} style={inputStyle} value={c.name} maxLength={80} placeholder={`Candidate ${ci + 1}`} onChange={(e) => patchRace(r.key, (x) => ({ ...x, candidates: x.candidates.map((y) => (y.key === c.key ? { ...y, name: e.target.value } : y)) }))} />
                    <input className={input} style={inputStyle} value={c.description} maxLength={200} placeholder="Platform line (optional)" onChange={(e) => patchRace(r.key, (x) => ({ ...x, candidates: x.candidates.map((y) => (y.key === c.key ? { ...y, description: e.target.value } : y)) }))} />
                    {r.candidates.length > 2 && (
                      <button type="button" className="rounded-full border px-3 text-xs font-bold" style={{ borderColor: "var(--border)" }} onClick={() => patchRace(r.key, (x) => ({ ...x, candidates: x.candidates.filter((y) => y.key !== c.key) }))}>×</button>
                    )}
                    <div className="grid gap-2 sm:col-span-3 sm:grid-cols-2">
                      <div className="grid gap-1 text-xs font-semibold">Photo
                        <ImageField value={c.photoUrl} onChange={(u) => patchRace(r.key, (x) => ({ ...x, candidates: x.candidates.map((y) => (y.key === c.key ? { ...y, photoUrl: u } : y)) }))} label="candidate photo" />
                      </div>
                      <div className="grid gap-1 text-xs font-semibold">Speech video (optional, up to 2 minutes)
                        {c.videoUrl ? (
                          <span className="flex items-center gap-2 font-normal">Video added
                            <button type="button" className="underline" onClick={() => patchRace(r.key, (x) => ({ ...x, candidates: x.candidates.map((y) => (y.key === c.key ? { ...y, videoUrl: null, videoSeconds: null } : y)) }))}>Remove</button>
                          </span>
                        ) : (
                          <>
                            {!c.videoLink.trim() && (
                              <FileUploadPicker mediaOnly maxSeconds={120} onUploaded={(u, secs) => patchRace(r.key, (x) => ({ ...x, candidates: x.candidates.map((y) => (y.key === c.key ? { ...y, videoUrl: u, videoSeconds: secs ?? null } : y)) }))} />
                            )}
                            <input className={input} style={inputStyle} value={c.videoLink} placeholder="Or paste a video link (YouTube, Vimeo, TikTok, Instagram)" onChange={(e) => patchRace(r.key, (x) => ({ ...x, candidates: x.candidates.map((y) => (y.key === c.key ? { ...y, videoLink: e.target.value } : y)) }))} />
                            {c.videoLink.trim() && !normalizeVideoLink(c.videoLink) && <span className="font-normal" style={{ color: "var(--danger)" }}>We can&apos;t play that link. Use a YouTube, Vimeo, TikTok or Instagram video link.</span>}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {r.candidates.length < 12 && (
                <button type="button" className="mt-2 text-xs font-bold underline" onClick={() => patchRace(r.key, (x) => ({ ...x, candidates: [...x.candidates, newCand()] }))}>+ Add candidate</button>
              )}
            </div>
          ))}
        </div>
        {races.length < 12 && (
          <button type="button" className="mt-3 rounded-full border px-4 py-2 text-sm font-bold" style={{ borderColor: "var(--border)" }} onClick={() => setRaces((rs) => [...rs, newRace()])}>+ Add another office</button>
        )}
      </section>

      <section className="mt-6">
        <label className="grid gap-1 text-sm font-semibold">
          Teacher PIN (6 digits)
          <input className={`${input} max-w-[200px] tracking-[0.3em]`} style={inputStyle} inputMode="numeric" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} placeholder="••••••" />
        </label>
        <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>Used on a kiosk to clear a lockout or leave kiosk mode. Keep it with the teachers, not the students.</p>
      </section>

      <div className="mt-8 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
        <p className="text-lg font-extrabold">Total {dollars(price)}</p>
        <p className="text-xs" style={{ color: "var(--text-faint)" }}>
          {LIVE_VOTE_TIERS[tier].label} {dollars(LIVE_VOTE_TIERS[tier].priceCents)}
          {kiosks > 1 && ` + ${kiosks - 1} extra kiosk${kiosks > 2 ? "s" : ""} ${dollars((kiosks - 1) * SCHOOL_ELECTION.extraKioskCents)}`}
          {days > 1 && ` + ${days - 1} extra day${days > 2 ? "s" : ""} ${dollars((days - 1) * SCHOOL_ELECTION.extraDayCents)}`}
          . You pay after adding the roster.
        </p>
        {error && <p className="mt-2 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
        <button onClick={submit} disabled={busy} className="bc-btn-solid mt-3 rounded-full px-6 py-3 text-sm font-bold disabled:opacity-60">
          {busy ? "Creating…" : "Create election"}
        </button>
      </div>
    </div>
  );
}
