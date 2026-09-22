"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";

const PLANS: { key: "bronze" | "silver" | "gold"; label: string; price: string; perks: string[] }[] = [
  {
    key: "bronze",
    label: "Bronze",
    price: "$500/mo",
    perks: [
      "Logo + link on a category of your choice",
      "\"Presented by\" credit on that category's bouts",
      "Listed on the sponsors page",
    ],
  },
  {
    key: "silver",
    label: "Silver",
    price: "$1,500/mo",
    perks: [
      "Everything in Bronze",
      "Sponsor a full bracket, not just one category",
      "Monthly engagement report (votes, reach)",
    ],
  },
  {
    key: "gold",
    label: "Gold",
    price: "$5,000/mo",
    perks: [
      "Everything in Silver",
      "Title-sponsor badge across the whole platform",
      "First pick of bracket or bout to sponsor",
      "Priority placement in sponsor engagement reporting",
    ],
  },
];

type OpportunityKey = "commercial" | "bracket" | "bout" | "curated" | "prizes";

const OPP_INFO: Record<
  OpportunityKey,
  { icon: string; title: string; desc: string; copy: string; category: boolean; banner: boolean }
> = {
  commercial: {
    icon: "🎬",
    title: "Platform-Wide Commercial",
    desc: "Your ad runs as a pre-roll or interstitial across BoutCasts — every category, every viewer.",
    copy: "No bout tie-in needed — your :15/:30 spot plays before clips platform-wide. Priced by impressions/week, reported back with view counts. Great for pure reach and brand awareness.",
    category: false,
    banner: false,
  },
  bracket: {
    icon: "🏆",
    title: "Sponsor a Full Bracket",
    desc: "Back an entire tournament, Round 1 to Champion — your logo on every match, one prize pool for the whole run.",
    copy: "Your logo and colors appear on every match in the bracket, from Round 1 to the Champion slot, with one prize pool paid out across the run. The whole tournament reads as \"presented by\" you.",
    category: true,
    banner: false,
  },
  bout: {
    icon: "🥊",
    title: "Sponsor a Single Bout",
    desc: "Pick one matchup or category and back it with branding and a prize.",
    copy: "Pick a category (or a specific matchup) to back with your branding and a prize — the lightest-weight way to get your name on a live bout.",
    category: true,
    banner: false,
  },
  curated: {
    icon: "🎨",
    title: "Fully Curated Bout",
    desc: "You design the whole thing — category, theme/rules, and who's invited to compete.",
    copy: "You set the category, the theme or rules, and who gets invited to compete — we handle hosting, voting and prize delivery so it still feels native to BoutCasts.",
    category: true,
    banner: false,
  },
  prizes: {
    icon: "🎁",
    title: "Prizes, Powered By You",
    desc: 'Skip curation — just supply the prize. We slot it into platform-curated bouts, tagged "Prizes brought to you by [you]."',
    copy: 'No curation needed — just supply gift-certificate prizes. We slot them into bouts we\'re already running across categories, tagged "Prizes brought to you by [you]."',
    category: false,
    banner: true,
  },
};

const BANNER_STYLES: { key: "minimal" | "bold" | "badge"; label: string }[] = [
  { key: "minimal", label: "Minimal Tag" },
  { key: "bold", label: "Bold Banner" },
  { key: "badge", label: "Icon Badge" },
];

function PrizeTagPreview({ style, brand }: { style: "minimal" | "bold" | "badge"; brand: string }) {
  const safeBrand = brand.trim() || "DoorDash";
  if (style === "bold") {
    return (
      <span
        className="inline-flex w-full items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white"
        style={{ background: "var(--blue)" }}
      >
        🎁 Prizes brought to you by <span className="font-bold">{safeBrand}</span>
      </span>
    );
  }
  if (style === "badge") {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-3"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <span
          className="flex h-5.5 w-5.5 items-center justify-center rounded-full text-xs text-white"
          style={{ background: "var(--blue)", width: 22, height: 22 }}
        >
          🎁
        </span>
        <span className="flex flex-col leading-tight">
          <span
            className="text-[9px] font-extrabold uppercase tracking-wide"
            style={{ color: "var(--text-faint)" }}
          >
            Prize Sponsor
          </span>
          <span className="text-xs font-bold">{safeBrand}</span>
        </span>
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold"
      style={{ color: "var(--blue)", background: "var(--blue-soft)" }}
    >
      🎁 Prizes brought to you by <span className="font-bold">{safeBrand}</span>
    </span>
  );
}

export default function SponsorApplyForm() {
  const supabase = createClient();
  const [plan, setPlan] = useState<"bronze" | "silver" | "gold">("bronze");
  const [opportunity, setOpportunity] = useState<OpportunityKey>("commercial");
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [bannerStyle, setBannerStyle] = useState<"minimal" | "bold" | "badge">("minimal");
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .order("sort_order")
      .then(({ data }) => setCategories((data as Category[]) ?? []));
  }, [supabase]);

  const info = OPP_INFO[opportunity];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName,
          websiteUrl,
          contactEmail,
          plan,
          message,
          opportunityType: opportunity,
          categoryId: info.category ? categoryId || null : null,
          bannerStyle: info.banner ? bannerStyle : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Something went wrong starting checkout.");
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {PLANS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setPlan(t.key)}
            className="rounded-xl border p-4 text-left transition"
            style={{
              borderColor: plan === t.key ? "var(--blue)" : "var(--border)",
              background: plan === t.key ? "var(--blue-soft)" : "var(--surface)",
            }}
          >
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>
                {t.label}
              </span>
              <span className="text-sm font-bold" style={{ color: "var(--blue)" }}>
                {t.price}
              </span>
            </div>
            <ul className="mt-2 flex flex-col gap-1 text-xs" style={{ color: "var(--text-faint)" }}>
              {t.perks.map((p) => (
                <li key={p}>✓ {p}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <div className="mb-2 text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Choose an opportunity
      </div>
      <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 md:grid-cols-3">
        {(Object.keys(OPP_INFO) as OpportunityKey[]).map((key) => {
          const o = OPP_INFO[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => setOpportunity(key)}
              className="rounded-xl border p-3.5 text-left"
              style={{
                borderColor: opportunity === key ? "var(--blue)" : "var(--border)",
                background: opportunity === key ? "var(--blue-soft)" : "var(--surface)",
              }}
            >
              <div className="mb-1.5 text-lg">{o.icon}</div>
              <div className="mb-1 text-xs font-bold">{o.title}</div>
              <div className="text-[11px] leading-snug" style={{ color: "var(--text-faint)" }}>
                {o.desc}
              </div>
            </button>
          );
        })}
      </div>

      <div
        className="mb-5 flex gap-3 rounded-xl border p-3.5"
        style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}
      >
        <span className="text-lg">{info.icon}</span>
        <div>
          <div className="mb-1 text-xs font-bold">{info.title}</div>
          <p className="text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
            {info.copy}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          required
          placeholder="Company or brand name"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
        />
        <input
          type="url"
          placeholder="Website (optional)"
          value={websiteUrl}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
        />
        <input
          type="email"
          required
          placeholder="Contact email"
          value={contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
        />

        {info.category && (
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
              Category to sponsor
            </label>
            <div className="flex flex-wrap gap-1.5">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className="rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{
                    borderColor: categoryId === c.id ? "var(--blue)" : "var(--border)",
                    background: categoryId === c.id ? "var(--blue-soft)" : "var(--surface)",
                    color: categoryId === c.id ? "var(--blue)" : "var(--text-dim)",
                  }}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {info.banner && (
          <div>
            <label className="mb-1 block text-xs font-semibold" style={{ color: "var(--text-dim)" }}>
              Choose your &quot;Prizes brought to you by&quot; banner
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {BANNER_STYLES.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBannerStyle(b.key)}
                  className="rounded-xl border p-3"
                  style={{
                    borderColor: bannerStyle === b.key ? "var(--blue)" : "var(--border)",
                    background: bannerStyle === b.key ? "var(--blue-soft)" : "var(--surface)",
                  }}
                >
                  <div className="mb-2 text-xs font-bold">{b.label}</div>
                  <div
                    className="flex min-h-[44px] items-center justify-center rounded-lg p-2"
                    style={{ background: "var(--surface-2)" }}
                  >
                    <PrizeTagPreview style={b.key} brand={companyName} />
                  </div>
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11px]" style={{ color: "var(--text-faint)" }}>
              This banner appears on any platform-curated bout your prizes get slotted into.
            </p>
          </div>
        )}

        <textarea
          placeholder="Anything specific you'd like to sponsor? (optional)"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className="rounded-lg border px-3 py-2 text-sm outline-none"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
        />
        {error && (
          <p className="text-sm" style={{ color: "var(--red)" }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="bc-btn-solid self-start rounded-full px-5 py-2.5 text-sm disabled:opacity-60"
        >
          {submitting ? "Starting checkout…" : `Start ${plan[0].toUpperCase()}${plan.slice(1)} sponsorship`}
        </button>
        <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
          Billed monthly via Stripe, cancel anytime. Our team reviews and activates every
          sponsorship within one business day of your first payment.
        </p>
      </form>
    </div>
  );
}
