"use client";

import { useEffect, useState } from "react";
import SignInCard from "@/components/SignInCard";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ClipSourcePicker, { type ClipSourceValue } from "@/components/ClipSourcePicker";
import FileUploadPicker from "@/components/FileUploadPicker";
import { LIVE_VOTE_TIERS, tierPriceLabel, type LiveVoteTier } from "@/lib/liveVoteEvents/tiers";
import { contrastRatio } from "@/lib/liveVoteEvents/roomTheme";
import { parseClock } from "@/lib/showcases";

type OptionDraft = {
  key: string;
  name: string;
  clip: ClipSourceValue;
  description: string;
  thumbnailUrl: string | null;
  teamName: string;
  start: string;
};

function newOption(): OptionDraft {
  return {
    key: Math.random().toString(36).slice(2),
    name: "",
    clip: { sourceType: "link", sourceUrl: "" },
    description: "",
    thumbnailUrl: null,
    teamName: "",
    start: "",
  };
}

export default function NewLiveVoteEventPage() {
  const supabase = createClient();
  const router = useRouter();

  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [title, setTitle] = useState("");
  const [catOptions, setCatOptions] = useState<{ id: string; name: string }[]>([]);
  const [subOptions, setSubOptions] = useState<{ id: string; name: string; category_id: string }[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [subcategoryId, setSubcategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [voterMode, setVoterMode] = useState<"account" | "open_link">("account");
  const [votingMethod, setVotingMethod] = useState<"single" | "ranked">("single");
  const [scoringMode, setScoringMode] = useState<"crowd" | "judges">("crowd");
  const [criteria, setCriteria] = useState<string[]>([""]);
  // Private (default): link, code or QR only; never listed. Public: listed on Explore.
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [tier, setTier] = useState<LiveVoteTier>("free");
  const isFree = tier === "free";
  const [options, setOptions] = useState<OptionDraft[]>([newOption(), newOption()]);
  // One video for the whole event (e.g. one dance video with 8 groups).
  const [sharedVideo, setSharedVideo] = useState(false);
  const [sharedClip, setSharedClip] = useState<ClipSourceValue>({ sourceType: "link", sourceUrl: "" });

  const [brandName, setBrandName] = useState("");
  const [brandLogoUrl, setBrandLogoUrl] = useState<string | null>(null);
  const [postVoteGraphicUrl, setPostVoteGraphicUrl] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState<string | null>(null);
  const [brandBgColor, setBrandBgColor] = useState<string | null>(null);
  const [whiteLabel, setWhiteLabel] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setSignedIn(!!data.user));
    supabase
      .from("categories")
      .select("id, name")
      .eq("is_listed", true)
      .is("owner_id", null)
      .order("sort_order")
      .then(({ data }) => setCatOptions(data ?? []));
    supabase
      .from("subcategories")
      .select("id, name, category_id")
      .order("sort_order")
      .then(({ data }) => setSubOptions(data ?? []));
  }, [supabase]);

  function updateOption(key: string, patch: Partial<OptionDraft>) {
    setOptions((prev) => prev.map((o) => (o.key === key ? { ...o, ...patch } : o)));
  }

  function addOption() {
    if (options.length >= 20) return;
    setOptions((prev) => [...prev, newOption()]);
  }

  function removeOption(key: string) {
    setOptions((prev) => (prev.length <= 2 ? prev : prev.filter((o) => o.key !== key)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      router.push("/login?next=%2Flive-vote%2Fnew");
      return;
    }

    if (!title.trim()) {
      setError("Give your event a title.");
      return;
    }

    const criteriaNames = criteria.map((c) => c.trim()).filter(Boolean);
    if (scoringMode === "judges" && new Set(criteriaNames.map((c) => c.toLowerCase())).size !== criteriaNames.length) {
      setError("Each scoring criterion needs a different name.");
      return;
    }

    if (options.length < 2) {
      setError("Add at least two options.");
      return;
    }

    for (const o of options) {
      if (!o.name.trim()) {
        setError("Every option needs a name.");
        return;
      }
      if (!sharedVideo && !o.clip.sourceUrl) {
        setError(`Add a clip for "${o.name || "an option"}" — upload, record, or paste a link.`);
        return;
      }
      if (Number.isNaN(parseClock(o.start))) {
        setError(`"${o.name}": the start time should look like 4:15 or 1:02:30.`);
        return;
      }
      if (o.description.length > 500) {
        setError(`The description for "${o.name || "an option"}" is over the 500-character limit.`);
        return;
      }
    }

    if (sharedVideo && !sharedClip.sourceUrl) {
      setError("Add the one video everyone will watch — upload, record, or paste a link.");
      return;
    }

    setLoading(true);

    const tierConfig = LIVE_VOTE_TIERS[tier];

    const { data: event, error: eventError } = await supabase
      .from("live_vote_events")
      .insert({
        organizer_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        voter_mode: voterMode,
        voting_method: scoringMode === "judges" ? "single" : votingMethod,
        scoring_mode: scoringMode,
        listed_publicly: visibility === "public",
        is_private: visibility === "private",
        category_id: categoryId || null,
        subcategory_id: subcategoryId || null,
        tier,
        price_cents: tierConfig.priceCents,
        status: "draft",
        brand_name: isFree ? null : brandName.trim() || null,
        brand_logo_url: isFree ? null : brandLogoUrl,
        post_vote_graphic_url: isFree ? null : postVoteGraphicUrl,
        brand_color: isFree ? null : brandColor,
        brand_bg_color: isFree ? null : brandBgColor,
        white_label: isFree ? false : whiteLabel,
        shared_source_type: sharedVideo ? sharedClip.sourceType : null,
        shared_source_url: sharedVideo ? sharedClip.sourceUrl : null,
      })
      .select("id")
      .single();

    if (eventError || !event) {
      setLoading(false);
      setError(eventError?.message || "Failed to create the event.");
      return;
    }

    const { error: optionsError } = await supabase.from("live_vote_options").insert(
      options.map((o, idx) => ({
        event_id: event.id,
        name: o.name.trim(),
        source_type: sharedVideo ? null : o.clip.sourceType,
        source_url: sharedVideo ? null : o.clip.sourceUrl,
        sort_order: idx,
        description: o.description.trim() || null,
        thumbnail_url: o.thumbnailUrl,
        team_name: o.teamName.trim() || null,
        start_seconds: sharedVideo ? parseClock(o.start) : null,
      }))
    );

    if (optionsError) {
      // Roll back the draft event so we don't leave an empty orphan behind —
      // allowed by RLS since it's still a draft the organizer owns.
      await supabase.from("live_vote_events").delete().eq("id", event.id);
      setLoading(false);
      setError(optionsError.message || "Failed to save the options.");
      return;
    }

    if (scoringMode === "judges" && criteriaNames.length > 0) {
      const { error: criteriaError } = await supabase.from("live_vote_criteria").insert(
        criteriaNames.map((name, idx) => ({ event_id: event.id, name, sort_order: idx }))
      );
      if (criteriaError) {
        await supabase.from("live_vote_events").delete().eq("id", event.id);
        setLoading(false);
        setError(criteriaError.message || "Failed to save the scoring criteria.");
        return;
      }
    }

    router.push(`/live-vote/${event.id}`);
  }

  const inputClass = "w-full rounded-[10px] border px-3.5 py-2.5 text-sm";
  const inputStyle = { borderColor: "var(--border)", background: "var(--surface)" };
  const labelClass = "mb-1.5 block text-xs font-bold uppercase tracking-wide";
  const labelStyle = { color: "var(--text-dim)" };

  if (signedIn === false) {
    return (
      <SignInCard
        eyebrow="New Live Vote"
        title="Start your Live Vote"
        body="It takes a minute to create a free account — then you'll come right back here to build your vote."
        next="/live-vote/new"
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Create a Live Vote Event
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Build your poll now, then take it live on the next step — free, or with a one-time
        per-event fee for bigger events.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className={labelClass} style={labelStyle}>
            Event title
          </label>
          <input
            className={inputClass}
            style={inputStyle}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Homecoming Step Show — Crowd Favorite"
            maxLength={140}
          />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Description (optional)
          </label>
          <textarea
            className={inputClass}
            style={{ ...inputStyle, minHeight: 80 }}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
          />
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Category (optional)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              className={inputClass}
              style={inputStyle}
              value={categoryId}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setSubcategoryId("");
              }}
            >
              <option value="">No category</option>
              {catOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {subOptions.some((sc) => sc.category_id === categoryId) && (
              <select
                className={inputClass}
                style={inputStyle}
                value={subcategoryId}
                onChange={(e) => setSubcategoryId(e.target.value)}
                aria-label="Subcategory"
              >
                <option value="">Any subcategory</option>
                {subOptions
                  .filter((sc) => sc.category_id === categoryId)
                  .map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
              </select>
            )}
          </div>
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
            Helps people find your vote on Explore (e.g. Dance › Group/Crew).
          </p>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Tier
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.entries(LIVE_VOTE_TIERS) as [LiveVoteTier, (typeof LIVE_VOTE_TIERS)[LiveVoteTier]][]).map(
              ([key, config]) => {
                const active = tier === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      setTier(key);
                      if (key === "free") {
                        setScoringMode("crowd");
                        setVotingMethod("single");
                      }
                    }}
                    className="rounded-[10px] border px-3 py-2.5 text-left"
                    style={{
                      borderColor: active ? "var(--red)" : "var(--border)",
                      background: active ? "var(--red-soft, var(--surface-2))" : "var(--surface)",
                    }}
                  >
                    <p className="text-sm font-bold" style={{ color: active ? "var(--red)" : "var(--text)" }}>
                      {config.label} — {tierPriceLabel(key)}
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                      Up to {config.voteCap.toLocaleString()} votes
                    </p>
                    <p className="text-xs" style={{ color: "var(--text-faint)" }}>
                      {config.durationMs >= 24 * 60 * 60 * 1000
                        ? `${Math.round(config.durationMs / (24 * 60 * 60 * 1000))}-day window`
                        : `${Math.round(config.durationMs / (60 * 60 * 1000))}-hour window`}
                    </p>
                  </button>
                );
              }
            )}
          </div>
          {isFree && (
            <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
              Free events are a basic &ldquo;pick one&rdquo; crowd vote with BoutCasts ads, one live at
              a time. Ranked choice, judges and custom branding come with paid tiers.
            </p>
          )}
        </div>

        {isFree ? (
          <div className="rounded-xl border p-3.5 text-xs" style={{ borderColor: "var(--border)", background: "var(--surface)", color: "var(--text-faint)" }}>
            <span className="font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Custom branding
            </span>{" "}
            — add your logo, sponsor name and a post-vote graphic on any paid tier.
          </div>
        ) : (
        <div
          className="rounded-xl border p-3.5"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
            Custom branding (optional)
          </p>
          <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
            Sponsoring a vote for a brand or client? Add their name and logo, and a graphic that
            voters see right after they submit their vote.
          </p>

          <label className={labelClass} style={labelStyle}>
            Brand / client name
          </label>
          <input
            className={inputClass}
            style={{ ...inputStyle, marginBottom: 12 }}
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="e.g. Acme Sneakers"
            maxLength={140}
          />

          <label className={labelClass} style={labelStyle}>
            Brand logo
          </label>
          <div className="mb-3">
            {brandLogoUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={brandLogoUrl}
                  alt="Brand logo"
                  className="h-12 w-12 rounded-lg border object-cover"
                  style={{ borderColor: "var(--border)" }}
                />
                <button
                  type="button"
                  onClick={() => setBrandLogoUrl(null)}
                  className="text-xs font-semibold"
                  style={{ color: "var(--text-faint)" }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <FileUploadPicker onUploaded={setBrandLogoUrl} />
            )}
          </div>

          <label className={labelClass} style={labelStyle}>
            Post-vote graphic
          </label>
          <p className="mb-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
            Shown to a voter right after they submit their vote.
          </p>
          <div>
            {postVoteGraphicUrl ? (
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={postVoteGraphicUrl}
                  alt="Post-vote graphic"
                  className="h-16 w-28 rounded-lg border object-cover"
                  style={{ borderColor: "var(--border)" }}
                />
                <button
                  type="button"
                  onClick={() => setPostVoteGraphicUrl(null)}
                  className="text-xs font-semibold"
                  style={{ color: "var(--text-faint)" }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <FileUploadPicker onUploaded={setPostVoteGraphicUrl} />
            )}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {(
              [
                ["Accent color", brandColor, setBrandColor, "#d92c4c", "Buttons, bars, highlights"],
                ["Page background", brandBgColor, setBrandBgColor, "#f6f4ef", "Behind your voting page"],
              ] as const
            ).map(([label, value, setter, fallback, hint]) => (
              <div key={label}>
                <label className={labelClass} style={labelStyle}>
                  {label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={value ?? fallback}
                    onChange={(e) => setter(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-md border"
                    style={{ borderColor: "var(--border)" }}
                    aria-label={label}
                  />
                  {value ? (
                    <button type="button" onClick={() => setter(null)} className="text-xs font-semibold" style={{ color: "var(--text-faint)" }}>
                      Reset
                    </button>
                  ) : (
                    <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                      Default
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[11px]" style={{ color: "var(--text-faint)" }}>
                  {hint}
                </p>
              </div>
            ))}
          </div>
          {brandColor && contrastRatio(brandColor, "#ffffff") < 3 && (
            <p className="mt-2 text-xs" style={{ color: "var(--red)" }}>
              This accent is very light — white button text on it will be hard to read. Try a darker shade.
            </p>
          )}
          {brandColor && brandBgColor && contrastRatio(brandColor, brandBgColor) < 2 && (
            <p className="mt-2 text-xs" style={{ color: "var(--red)" }}>
              Your accent and background are too similar — bars and buttons will blend in.
            </p>
          )}

          <label className="mt-4 flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--red)]"
              checked={whiteLabel}
              onChange={(e) => setWhiteLabel(e.target.checked)}
            />
            <span className="text-sm">
              <span className="font-semibold">White-label voting page</span>
              <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                Hide the BoutCasts menu and footer so your brand is front and center (a small
                &ldquo;Powered by BoutCasts&rdquo; line stays). Included with Large, Pro analytics or
                Organizer Pro.
              </span>
            </span>
          </label>
          <p className="mt-3 text-xs" style={{ color: "var(--text-faint)" }}>
            You can add sponsor banners from your event page after creating it.
          </p>
        </div>
        )}

        <div>
          <label className={labelClass} style={labelStyle}>
            Who can find this event?
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ["private", "🔒 Private", "Schools, teams & private groups. Only people with your link, 6-letter code or QR code can vote. Never shown publicly. No ads — add your own sponsors to fundraise."],
                ["public", "🌎 Public", "Listed on the Explore page so anyone on BoutCasts can find it and vote."],
              ] as const
            ).map(([value, label, hint]) => (
              <label
                key={value}
                className="flex cursor-pointer items-start gap-3 rounded-xl border p-3.5"
                style={{
                  borderColor: visibility === value ? "var(--red)" : "var(--border)",
                  background: visibility === value ? "var(--red-soft)" : "var(--surface)",
                }}
              >
                <input
                  type="radio"
                  name="visibility"
                  className="mt-0.5 h-4 w-4 accent-[var(--red)]"
                  checked={visibility === value}
                  onChange={() => setVisibility(value)}
                />
                <span className="text-sm">
                  <span className="font-semibold">{label}</span>
                  <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                    {hint}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            How is the winner decided?
          </label>
          <div className="flex gap-2">
            {(
              [
                ["crowd", "Crowd vote"],
                ["judges", "Judges panel"],
              ] as const
            ).map(([value, label]) => {
              const active = scoringMode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScoringMode(value)}
                  disabled={isFree && value === "judges"}
                  title={isFree && value === "judges" ? "Judges panels need a paid tier" : undefined}
                  className="flex-1 rounded-[10px] border px-3 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: active ? "var(--red)" : "var(--border)",
                    background: active ? "var(--red-soft, var(--surface-2))" : "var(--surface)",
                    color: active ? "var(--red)" : "var(--text-dim)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
            {scoringMode === "crowd"
              ? "Your audience votes from their phones and the tally updates live."
              : "Judges you invite score each contestant 1–10 from a private link — no account needed. The public page shows the contestants, and the scoreboard appears when you release results."}
          </p>

          {scoringMode === "judges" && (
            <div className="mt-3 rounded-xl border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
                Scoring criteria
              </p>
              <p className="mb-2.5 text-xs" style={{ color: "var(--text-faint)" }}>
                Judges score each one 1–10; a contestant&apos;s score is the average. Leave blank for a
                single overall score.
              </p>
              <div className="flex flex-col gap-2">
                {criteria.map((c, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={c}
                      maxLength={60}
                      placeholder={i === 0 ? "e.g. Vocals" : i === 1 ? "e.g. Stage presence" : "Another criterion"}
                      onChange={(e) => setCriteria((prev) => prev.map((x, j) => (j === i ? e.target.value : x)))}
                    />
                    {criteria.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setCriteria((prev) => prev.filter((_, j) => j !== i))}
                        className="px-2 text-xs font-semibold"
                        style={{ color: "var(--text-faint)" }}
                        aria-label="Remove criterion"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {criteria.length < 8 && (
                <button
                  type="button"
                  onClick={() => setCriteria((prev) => [...prev, ""])}
                  className="mt-2 text-xs font-semibold"
                  style={{ color: "var(--red)" }}
                >
                  + Add criterion
                </button>
              )}
              <p className="mt-2 text-xs" style={{ color: "var(--text-faint)" }}>
                You&apos;ll add judges and get their private links after you create the event.
              </p>
            </div>
          )}
        </div>

        {scoringMode === "crowd" && (
        <>
        <div>
          <label className={labelClass} style={labelStyle}>
            How do people vote?
          </label>
          <div className="flex gap-2">
            {(
              [
                ["single", "Pick one"],
                ["ranked", "Ranked choice"],
              ] as const
            ).map(([value, label]) => {
              const active = votingMethod === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVotingMethod(value)}
                  disabled={isFree && value === "ranked"}
                  title={isFree && value === "ranked" ? "Ranked choice needs a paid tier" : undefined}
                  className="flex-1 rounded-[10px] border px-3 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: active ? "var(--red)" : "var(--border)",
                    background: active ? "var(--red-soft, var(--surface-2))" : "var(--surface)",
                    color: active ? "var(--red)" : "var(--text-dim)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
            {votingMethod === "single"
              ? "Each voter picks one option. Most votes wins."
              : "Voters rank the options in order of preference. If nobody has a majority, the last-place option is eliminated and those ballots move to their next choice, round by round, until one option has a majority. Best for elections with 3+ candidates."}
          </p>
        </div>

        <div>
          <label className={labelClass} style={labelStyle}>
            Who can vote?
          </label>
          <div className="flex gap-2">
            {(
              [
                ["account", "BoutCasts account required"],
                ["open_link", "Open link — no account needed"],
              ] as const
            ).map(([value, label]) => {
              const active = voterMode === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setVoterMode(value)}
                  className="flex-1 rounded-[10px] border px-3 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                  style={{
                    borderColor: active ? "var(--red)" : "var(--border)",
                    background: active ? "var(--red-soft, var(--surface-2))" : "var(--surface)",
                    color: active ? "var(--red)" : "var(--text-dim)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5 text-xs" style={{ color: "var(--text-faint)" }}>
            {voterMode === "account"
              ? "One vote per BoutCasts account. Voters sign in to cast their vote."
              : "One vote per browser (tracked with a private link token). No sign-in needed — easiest to share, but easier to work around than an account."}
          </p>
        </div>
        </>
        )}

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className={labelClass} style={{ ...labelStyle, marginBottom: 0 }}>
              Options ({options.length})
            </label>
            <button
              type="button"
              onClick={addOption}
              disabled={options.length >= 20}
              className="text-xs font-bold underline disabled:opacity-40"
              style={{ color: "var(--red)" }}
            >
              + Add option
            </button>
          </div>

          <div className="mb-4 rounded-xl border p-3" style={{ borderColor: sharedVideo ? "var(--red)" : "var(--border)", background: "var(--surface)" }}>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[var(--red)]" checked={sharedVideo} onChange={(e) => setSharedVideo(e.target.checked)} />
              <span>
                <b>One video for all options</b>
                <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
                  e.g. one dance-competition video with 8 groups. Voters watch once, then pick. Add each group&apos;s start
                  time so voters can jump to their part.
                </span>
              </span>
            </label>
            {sharedVideo && (
              <div className="mt-3">
                <ClipSourcePicker value={sharedClip} onChange={setSharedClip} inputClass={inputClass} inputStyle={inputStyle} />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {options.map((option, idx) => (
              <div
                key={option.key}
                className="rounded-xl border p-3"
                style={{ borderColor: "var(--border)", background: "var(--surface)" }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold" style={{ color: "var(--text-dim)" }}>
                    Option {idx + 1}
                  </span>
                  {options.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removeOption(option.key)}
                      className="text-xs font-semibold"
                      style={{ color: "var(--text-faint)" }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                <input
                  className={inputClass}
                  style={{ ...inputStyle, marginBottom: 10 }}
                  value={option.name}
                  onChange={(e) => updateOption(option.key, { name: e.target.value })}
                  placeholder="Option name"
                  maxLength={140}
                />
                <div className="mb-2.5 grid gap-2 sm:grid-cols-[1fr_140px]">
                  <input
                    className={inputClass}
                    style={inputStyle}
                    value={option.teamName}
                    onChange={(e) => updateOption(option.key, { teamName: e.target.value.slice(0, 80) })}
                    placeholder="Team / school (optional)"
                  />
                  {sharedVideo && (
                    <input
                      className={inputClass}
                      style={inputStyle}
                      value={option.start}
                      onChange={(e) => updateOption(option.key, { start: e.target.value })}
                      placeholder="Starts at 4:15"
                    />
                  )}
                </div>
                {!sharedVideo && (
                  <ClipSourcePicker
                    value={option.clip}
                    onChange={(clip) => updateOption(option.key, { clip })}
                    inputClass={inputClass}
                    inputStyle={inputStyle}
                  />
                )}

                <div className="mt-3">
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                      Description (optional)
                    </label>
                    <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                      {option.description.length}/500
                    </span>
                  </div>
                  <textarea
                    className={inputClass}
                    style={{ ...inputStyle, minHeight: 60 }}
                    value={option.description}
                    onChange={(e) =>
                      updateOption(option.key, { description: e.target.value.slice(0, 500) })
                    }
                    placeholder="A short blurb voters see for this option"
                  />
                </div>

                <div className="mt-3">
                  <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
                    Logo or picture (optional)
                  </label>
                  {option.thumbnailUrl ? (
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={option.thumbnailUrl}
                        alt={`${option.name || "Option"} thumbnail`}
                        className="h-14 w-14 rounded-lg border object-cover"
                        style={{ borderColor: "var(--border)" }}
                      />
                      <button
                        type="button"
                        onClick={() => updateOption(option.key, { thumbnailUrl: null })}
                        className="text-xs font-semibold"
                        style={{ color: "var(--text-faint)" }}
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <FileUploadPicker
                      onUploaded={(url) => updateOption(option.key, { thumbnailUrl: url })}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--danger)" }}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60"
        >
          {loading ? "Creating…" : "Save draft & continue"}
        </button>
      </form>
    </div>
  );
}
