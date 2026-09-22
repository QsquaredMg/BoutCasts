"use client";

import { useState } from "react";

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

export default function SponsorApplyForm() {
  const [plan, setPlan] = useState<"bronze" | "silver" | "gold">("bronze");
  const [companyName, setCompanyName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout/sponsor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, websiteUrl, contactEmail, plan, message }),
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
