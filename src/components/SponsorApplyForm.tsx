"use client";

import { useState } from "react";

const TIERS: { key: "standard" | "title"; label: string; price: string; perks: string[] }[] = [
  {
    key: "standard",
    label: "Standard",
    price: "$299",
    perks: [
      "Logo + link on a category of your choice",
      "\"Presented by\" credit on that category's bouts",
      "Listed on the sponsors page",
    ],
  },
  {
    key: "title",
    label: "Title sponsor",
    price: "$999",
    perks: [
      "Everything in Standard",
      "Title-sponsor badge across the whole platform",
      "First pick of bracket or bout to sponsor",
      "Priority placement in sponsor engagement reporting",
    ],
  },
];

export default function SponsorApplyForm() {
  const [tier, setTier] = useState<"standard" | "title">("standard");
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
        body: JSON.stringify({ companyName, websiteUrl, contactEmail, tier, message }),
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
      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        {TIERS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTier(t.key)}
            className="rounded-xl border p-4 text-left transition"
            style={{
              borderColor: tier === t.key ? "var(--gold)" : "var(--border)",
              background: tier === t.key ? "var(--gold-soft)" : "var(--surface)",
            }}
          >
            <div className="mb-1 flex items-baseline justify-between">
              <span className="text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>
                {t.label}
              </span>
              <span className="text-sm font-bold" style={{ color: "var(--gold)" }}>
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
          {submitting ? "Starting checkout…" : `Become a ${tier === "title" ? "title" : "standard"} sponsor`}
        </button>
        <p className="text-[11px]" style={{ color: "var(--text-faint)" }}>
          You&apos;ll pay securely via Stripe. Our team reviews and activates every sponsorship
          within one business day of payment.
        </p>
      </form>
    </div>
  );
}
