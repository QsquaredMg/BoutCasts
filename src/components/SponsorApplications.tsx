"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";

type Application = {
  id: string;
  company_name: string;
  website_url: string | null;
  contact_email: string;
  tier: "title" | "standard";
  plan_name: string | null;
  message: string | null;
  amount_paid: number | null;
  created_at: string;
  opportunity_type: string | null;
  category_id: string | null;
  banner_style: string | null;
  categories?: { name: string }[] | { name: string } | null;
};

const OPP_LABEL: Record<string, string> = {
  commercial: "Platform-wide commercial",
  bracket: "Sponsor a full bracket",
  bout: "Sponsor a single bout",
  curated: "Fully curated bout",
  prizes: "Prizes, powered by you",
};

function categoryName(categories: Application["categories"]): string | null {
  if (!categories) return null;
  return Array.isArray(categories) ? categories[0]?.name ?? null : categories.name ?? null;
}

export default function SponsorApplications({ initial }: { initial: Application[] }) {
  const supabase = createClient();
  const [applications, setApplications] = useState(initial);
  const [logoUrls, setLogoUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { showToast } = useToast();

  async function approve(id: string) {
    setError(null);
    setBusy(id);
    const { error } = await supabase.rpc("approve_sponsor_application", {
      p_application_id: id,
      p_logo_url: logoUrls[id] || null,
    });
    setBusy(null);
    if (error) {
      setError(error.message);
      showToast(error.message, "error");
      return;
    }
    setApplications((prev) => prev.filter((a) => a.id !== id));
    showToast("Sponsor application approved — sponsor is live", "success");
  }

  async function reject(id: string) {
    setError(null);
    setBusy(id);
    const { error } = await supabase.rpc("reject_sponsor_application", {
      p_application_id: id,
    });
    setBusy(null);
    if (error) {
      setError(error.message);
      showToast(error.message, "error");
      return;
    }
    setApplications((prev) => prev.filter((a) => a.id !== id));
    showToast("Sponsor application rejected", "info");
  }

  if (applications.length === 0) return null;

  return (
    <div className="bc-card mb-8 flex flex-col overflow-hidden">
      <div className="px-5 pt-5">
        <h2 className="mb-1 text-sm font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Sponsor applications
        </h2>
        <p className="mb-3 text-xs" style={{ color: "var(--text-faint)" }}>
          Paid and waiting for review — approving creates a live sponsor entry.
        </p>
        {error && (
          <p className="mb-3 text-sm" style={{ color: "var(--red)" }}>
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-col">
        {applications.map((a, i) => (
          <div
            key={a.id}
            className="flex flex-col gap-2 px-5 py-4"
            style={{ borderTop: i > 0 ? "1px solid var(--border)" : "none" }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold">
                {a.company_name}{" "}
                <span
                  className="bc-badge-gold ml-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                >
                  {a.plan_name ?? a.tier}
                </span>
              </span>
              <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                {a.amount_paid ? `$${(a.amount_paid / 100).toFixed(2)}/mo` : "—"}
              </span>
            </div>
            <div className="text-xs" style={{ color: "var(--text-faint)" }}>
              {a.contact_email}
              {a.website_url && <> · {a.website_url}</>}
            </div>
            {a.opportunity_type && (
              <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                {OPP_LABEL[a.opportunity_type] ?? a.opportunity_type}
                {categoryName(a.categories) && <> · {categoryName(a.categories)}</>}
                {a.banner_style && <> · {a.banner_style} banner</>}
              </div>
            )}
            {a.message && (
              <p className="text-xs italic" style={{ color: "var(--text-dim)" }}>
                &ldquo;{a.message}&rdquo;
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="url"
                placeholder="Logo URL (optional)"
                value={logoUrls[a.id] ?? ""}
                onChange={(e) => setLogoUrls((prev) => ({ ...prev, [a.id]: e.target.value }))}
                className="min-w-[220px] flex-1 rounded-lg border px-3 py-1.5 text-xs outline-none"
                style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }}
              />
              <button
                onClick={() => approve(a.id)}
                disabled={busy === a.id}
                className="rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-60"
                style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
              >
                Approve
              </button>
              <button
                onClick={() => reject(a.id)}
                disabled={busy === a.id}
                className="rounded-full border px-3 py-1.5 text-xs font-bold disabled:opacity-60"
                style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
              >
                Reject
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
