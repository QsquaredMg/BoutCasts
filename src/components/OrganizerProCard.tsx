"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ORGANIZER_PRO, PRO_ADDON_CENTS } from "@/lib/liveVoteEvents/tiers";

type PlanStatus = {
  active: boolean;
  license?: string | null;
  unlimited?: boolean;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  included_per_period: number;
  included_used: number;
};

// Organizer Pro monthly plan: subscribe, or manage billing if subscribed.
export default function OrganizerProCard() {
  const supabase = createClient();
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [planParam, setPlanParam] = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc("organizer_pro_status", {}).then(({ data }) => setPlan((data as PlanStatus) ?? null));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlanParam(new URLSearchParams(window.location.search).get("plan"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function go(path: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      window.location.assign(data.url);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  const active = Boolean(plan?.active);

  if (plan?.unlimited) {
    return (
      <div id="organizer-pro" className="mb-8 rounded-xl border p-5" style={{ borderColor: "var(--red)", background: "var(--surface)" }}>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--red)" }}>
          School &amp; League License · Active
        </p>
        <p className="mt-1 font-semibold">You&apos;re covered by the {plan.license} license.</p>
        <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>
          Unlimited Small &amp; Medium Live Votes with Pro analytics and white-label — just create an
          event and choose &ldquo;Go live — included in your license&rdquo;.
        </p>
        <a href="/org" className="mt-3 inline-block text-sm font-semibold underline" style={{ color: "var(--red)" }}>
          License dashboard →
        </a>
      </div>
    );
  }
  const left = plan ? Math.max(0, plan.included_per_period - plan.included_used) : 0;

  return (
    <div
      id="organizer-pro"
      className="mb-8 rounded-xl border p-5"
      style={{ borderColor: "var(--red)", background: "var(--surface)" }}
    >
      {planParam === "success" && !active && (
        <p className="mb-3 rounded-lg p-2.5 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
          Payment received — your plan activates within a moment. Refresh if it doesn&apos;t show yet.
        </p>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--red)" }}>
          Organizer Pro {active && "· Active"}
        </p>
        <p className="text-xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          ${ORGANIZER_PRO.priceCents / 100}
          <span className="text-sm font-semibold" style={{ color: "var(--text-faint)" }}>
            /month
          </span>
        </p>
      </div>
      <p className="mt-1 font-semibold">For schools, leagues and anyone running votes every month.</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm" style={{ color: "var(--text-dim)" }}>
        <li>✓ {ORGANIZER_PRO.includedEventsPerPeriod} Small or Medium events included every month (a $447 value)</li>
        <li>✓ Pro analytics on every event — turnout, demographics, CSV export (normally +${PRO_ADDON_CENTS / 100} each)</li>
        <li>✓ Extra and Large events at regular per-event prices · cancel anytime</li>
      </ul>

      {active ? (
        <>
          <p className="mt-3 text-sm">
            <b>
              {left} of {plan!.included_per_period}
            </b>{" "}
            included events left this period
            {plan!.current_period_end &&
              ` · ${plan!.cancel_at_period_end ? "ends" : "renews"} ${new Date(plan!.current_period_end).toLocaleDateString()}`}
            .
          </p>
          <button
            type="button"
            onClick={() => go("/api/billing/portal")}
            disabled={busy}
            className="mt-3 w-full rounded-full border px-4 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
          >
            {busy ? "Opening…" : "Manage billing"}
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => go("/api/checkout/organizer-pro")}
          disabled={busy}
          className="bc-btn-solid mt-4 w-full rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-60"
        >
          {busy ? "Starting checkout…" : `Get Organizer Pro — $${ORGANIZER_PRO.priceCents / 100}/month`}
        </button>
      )}
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
