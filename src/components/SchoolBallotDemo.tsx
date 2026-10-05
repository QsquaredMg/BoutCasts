"use client";

import { useState } from "react";
import Link from "next/link";

// Interactive sample ballot for the /schools page. Visitors pick a kind of vote
// (class president, prom court, ...) and a set of school colors, then cast a
// practice vote to see the live tally. Nothing here is saved or counted: the
// results are illustrative and labelled "Sample".

export type DemoCandidate = { name: string; note: string; imageUrl: string | null };

export type DemoRealEvent = {
  id: string;
  title: string;
  brandName: string;
  logoUrl: string | null;
  candidates: DemoCandidate[];
};

type Theme = { key: string; label: string; school: string; accent: string; paper: string; ink: string; onAccent: string };

const THEMES: Theme[] = [
  { key: "jc", label: "Maroon & cream", school: "JC High School", accent: "#7a1f3d", paper: "#fbf6ea", ink: "#2a1219", onAccent: "#ffffff" },
  { key: "navy", label: "Navy & gold", school: "Your School", accent: "#14305c", paper: "#f6f4ee", ink: "#101a2b", onAccent: "#f2c14e" },
  { key: "forest", label: "Forest & white", school: "Your School", accent: "#1f5a3a", paper: "#f7faf6", ink: "#12261a", onAccent: "#ffffff" },
  { key: "royal", label: "Royal & silver", school: "Your School", accent: "#2b46c7", paper: "#f3f5fb", ink: "#141a33", onAccent: "#ffffff" },
  { key: "black", label: "Black & red", school: "Your School", accent: "#16161a", paper: "#faf5f5", ink: "#1a1214", onAccent: "#ff4b5c" },
];

type Scenario = {
  key: string;
  tab: string;
  kicker: string;
  title: string;
  hint: string;
  options: DemoCandidate[];
  tally: number[];
  footer: string;
};

const FALLBACK_PRESIDENT: DemoCandidate[] = [
  { name: "MJ King", note: "A student-run quiet room and peer support space.", imageUrl: null },
  { name: "Harley Lane", note: "A Student Cafeteria Council to fix lunch.", imageUrl: null },
  { name: "Katy Lee", note: "Free peer tutoring and a fair homework-load policy.", imageUrl: null },
];

function buildScenarios(real: DemoRealEvent | null): Scenario[] {
  return [
    {
      key: "president",
      tab: "Class president",
      kicker: "Student government",
      title: real?.title.replace(/\s*\(Sample\)\s*$/i, "") ?? "JC High Class President",
      hint: "Choose one candidate",
      options: real?.candidates.length ? real.candidates : FALLBACK_PRESIDENT,
      tally: [41, 27, 32],
      footer: "Photo, platform and a speech of up to 3 minutes for every candidate",
    },
    {
      key: "prom",
      tab: "Prom court",
      kicker: "Prom 2027",
      title: "Who should wear the crown?",
      hint: "Choose one",
      options: [
        { name: "Aaliyah Brooks", note: "Senior · Dance team captain", imageUrl: null },
        { name: "Mateo Reyes", note: "Senior · Student body treasurer", imageUrl: null },
        { name: "Priya Nair", note: "Senior · Yearbook editor", imageUrl: null },
        { name: "Jordan Kim", note: "Senior · Varsity soccer", imageUrl: null },
      ],
      tally: [34, 22, 28, 16],
      footer: "Share one link or QR code on the morning announcements",
    },
    {
      key: "homecoming",
      tab: "Homecoming court",
      kicker: "Homecoming week",
      title: "Senior class court",
      hint: "Choose one",
      options: [
        { name: "Destiny Carter", note: "Marching band drum major", imageUrl: null },
        { name: "Luis Hernandez", note: "Varsity football, #12", imageUrl: null },
        { name: "Mei Tanaka", note: "Student council vice president", imageUrl: null },
      ],
      tally: [38, 35, 27],
      footer: "Put the live tally on the gym screen at the pep rally",
    },
    {
      key: "best",
      tab: "Best of the Best",
      kicker: "Spirit awards",
      title: "Best teacher of the year",
      hint: "Choose one",
      options: [
        { name: "Mr. Okafor", note: "AP Chemistry", imageUrl: null },
        { name: "Ms. Delgado", note: "Choir and theater", imageUrl: null },
        { name: "Coach Walker", note: "Physical education", imageUrl: null },
        { name: "Dr. Shah", note: "Algebra II", imageUrl: null },
      ],
      tally: [24, 31, 29, 16],
      footer: "One vote per category, up to 20 choices in each",
    },
    {
      key: "debate",
      tab: "Debate",
      kicker: "Resolved",
      title: "School should start at 9 a.m.",
      hint: "Which side persuaded you?",
      options: [
        { name: "Affirmative", note: "Team Eastside", imageUrl: null },
        { name: "Negative", note: "Team Westgate", imageUrl: null },
      ],
      tally: [57, 43],
      footer: "Judges score privately with their own links. The crowd votes too.",
    },
  ];
}

function initials(name: string) {
  const words = name.replace(/^(Mr|Ms|Mrs|Dr|Coach)\.?\s+/i, "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  const a = words[0][0] ?? "";
  const b = words.length > 1 ? (words[words.length - 1][0] ?? "") : (words[0][1] ?? "");
  return (a + b).toUpperCase();
}

function Avatar({ c, theme, size }: { c: DemoCandidate; theme: Theme; size: number }) {
  if (c.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={c.imageUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size, border: `2px solid ${theme.accent}` }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-extrabold"
      style={{ width: size, height: size, background: theme.accent, color: theme.onAccent, fontSize: size * 0.36 }}
    >
      {initials(c.name)}
    </span>
  );
}

export default function SchoolBallotDemo({ real }: { real: DemoRealEvent | null }) {
  const scenarios = buildScenarios(real);
  const [sIdx, setSIdx] = useState(0);
  const [tIdx, setTIdx] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [voted, setVoted] = useState(false);

  const s = scenarios[sIdx];
  const t = THEMES[tIdx];
  const isJc = tIdx === 0;
  const school = isJc && real ? real.brandName : t.school;

  function chooseScenario(i: number) {
    setSIdx(i);
    setPick(null);
    setVoted(false);
  }

  // Your practice vote nudges the sample numbers so the bars visibly move.
  const shown = s.tally.map((n, i) => n + (voted && pick === i ? 6 : 0));
  const shownTotal = shown.reduce((a, b) => a + b, 0);
  const lead = shown.indexOf(Math.max(...shown));

  return (
    <div className="w-full min-w-0 max-w-[520px]">
      {/* what kind of vote */}
      <div role="group" aria-label="Choose a kind of vote" className="mb-3 flex flex-wrap gap-2">
        {scenarios.map((sc, i) => (
          <button
            key={sc.key}
            type="button"
            onClick={() => chooseScenario(i)}
            aria-pressed={i === sIdx}
            className="shrink-0 rounded-full px-4 py-2 text-[14px] font-bold transition-colors"
            style={
              i === sIdx
                ? { background: "#fff", color: "#3b0d1f" }
                : { background: "rgba(255,255,255,0.12)", color: "#f3dfe6", border: "1px solid rgba(255,255,255,0.25)" }
            }
          >
            {sc.tab}
          </button>
        ))}
      </div>

      {/* the ballot */}
      <div
        className="overflow-hidden rounded-[22px]"
        style={{ background: t.paper, color: t.ink, boxShadow: "0 40px 90px rgba(0,0,0,0.5)", transition: "background-color .3s" }}
      >
        <div className="flex items-center gap-3 px-5 py-4" style={{ background: t.accent, color: t.onAccent, transition: "background-color .3s" }}>
          {isJc && real?.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={real.logoUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-full bg-white object-cover" />
          ) : (
            <span
              aria-hidden
              className="flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-extrabold"
              style={{ background: t.onAccent, color: t.accent }}
            >
              {isJc ? "JC" : "YS"}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-extrabold leading-tight">{school}</div>
            <div className="truncate text-[12px] opacity-80">{s.kicker}</div>
          </div>
          <span className="flex items-center gap-1.5 text-[12px] font-extrabold">
            <span className="lp-live-dot" aria-hidden /> LIVE
          </span>
        </div>

        <div className="px-5 pb-5 pt-5">
          <h3 className="lp-title text-[24px] leading-tight sm:text-[27px]">{s.title}</h3>
          <p className="mt-1 text-[14px]" style={{ opacity: 0.7 }}>
            {voted ? "Thanks for voting. Here is the live tally." : s.hint}
          </p>

          <div role="radiogroup" aria-label={s.title} className="mt-4 flex flex-col gap-2.5">
            {s.options.map((c, i) => {
              const pct = Math.round((shown[i] / shownTotal) * 100);
              const selected = pick === i;
              const leading = voted && i === lead;
              return (
                <button
                  key={c.name}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={voted}
                  onClick={() => setPick(i)}
                  className="relative overflow-hidden rounded-2xl text-left"
                  style={{
                    border: `2px solid ${selected || leading ? t.accent : "rgba(0,0,0,0.12)"}`,
                    background: "#fff",
                    cursor: voted ? "default" : "pointer",
                  }}
                >
                  <span
                    aria-hidden
                    className="absolute inset-y-0 left-0"
                    style={{
                      width: voted ? `${pct}%` : selected ? "100%" : "0%",
                      background: t.accent,
                      opacity: voted ? 0.16 : 0.08,
                      transition: "width .9s cubic-bezier(.2,.8,.2,1), opacity .3s",
                    }}
                  />
                  <span className="relative flex items-center gap-3 px-3.5 py-3">
                    <Avatar c={c} theme={t} size={s.options.length > 3 ? 44 : 52} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[16px] font-extrabold leading-tight">{c.name}</span>
                      <span className="mt-0.5 block text-[13px] leading-snug" style={{ opacity: 0.68 }}>
                        {c.note}
                      </span>
                    </span>
                    {voted ? (
                      <span className="text-[20px] font-extrabold tabular-nums" style={{ color: leading ? t.accent : "inherit" }}>
                        {pct}%
                      </span>
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                        style={{ border: `2px solid ${selected ? t.accent : "rgba(0,0,0,0.25)"}`, background: selected ? t.accent : "transparent" }}
                      >
                        {selected && <span className="h-2 w-2 rounded-full" style={{ background: t.onAccent }} />}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {voted ? (
            <div className="mt-4 flex items-center justify-between gap-3 text-[13px]">
              <span style={{ opacity: 0.7 }}>
                Sample results · {shownTotal} practice votes
              </span>
              <button
                type="button"
                onClick={() => {
                  setVoted(false);
                  setPick(null);
                }}
                className="font-bold underline"
                style={{ color: t.accent }}
              >
                Vote again
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={pick === null}
              onClick={() => setVoted(true)}
              className="mt-4 w-full rounded-2xl py-3.5 text-[16px] font-extrabold transition-opacity disabled:opacity-40"
              style={{ background: t.accent, color: t.onAccent }}
            >
              Cast my vote
            </button>
          )}

          <p className="mt-3 text-[12px]" style={{ opacity: 0.6 }}>
            {s.footer}
          </p>
        </div>
      </div>

      {/* your colors */}
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="text-[14px] font-bold" style={{ color: "#f3dfe6" }}>
          Your colors
        </span>
        <div role="group" aria-label="Try school colors" className="flex gap-2">
          {THEMES.map((th, i) => (
            <button
              key={th.key}
              type="button"
              onClick={() => setTIdx(i)}
              aria-label={th.label}
              aria-pressed={i === tIdx}
              title={th.label}
              className="h-9 w-9 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${th.accent} 0 55%, ${th.paper} 55% 100%)`,
                border: i === tIdx ? "3px solid #fff" : "2px solid rgba(255,255,255,0.35)",
                boxShadow: i === tIdx ? "0 0 0 2px rgba(0,0,0,0.25)" : "none",
              }}
            />
          ))}
        </div>
      </div>

      {real && sIdx === 0 && isJc && (
        <Link href={`/live-vote/${real.id}`} className="mt-4 inline-block text-[14px] font-bold underline" style={{ color: "#fff" }}>
          Vote on the real JC High sample ballot
        </Link>
      )}
      <p className="mt-2 text-[12px]" style={{ color: "#d9b9c4" }}>
        Practice ballot. Names and numbers are fictional and nothing here is counted.
      </p>
    </div>
  );
}
