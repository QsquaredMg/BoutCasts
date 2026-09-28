"use client";

import { useEffect, useState, useCallback } from "react";
import RankedResults from "@/components/RankedResults";
import JudgePanelManager from "@/components/JudgePanelManager";
import ShareEventModal from "@/components/ShareEventModal";
import LiveVoteAnalyticsPanel from "@/components/LiveVoteAnalyticsPanel";
import EventSponsorManager from "@/components/EventSponsorManager";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LIVE_VOTE_TIERS, ORGANIZER_PRO, PRO_ADDON_CENTS, tierPriceLabel, type LiveVoteTier } from "@/lib/liveVoteEvents/tiers";

type EventStatus = "draft" | "live" | "closed";

type LiveVoteEventDetail = {
  id: string;
  organizer_id: string;
  voting_method: "single" | "ranked";
  scoring_mode: "crowd" | "judges";
  results_released: boolean;
  listed_publicly: boolean;
  pro_enabled: boolean;
  collect_demographics: boolean;
  title: string;
  description: string | null;
  voter_mode: "account" | "open_link";
  tier: LiveVoteTier;
  status: EventStatus;
  starts_at: string | null;
  closes_at: string | null;
};

type LiveVoteOptionRow = {
  id: string;
  name: string;
  source_type: string;
  sort_order: number;
};

type PlanStatus = {
  active: boolean;
  license?: string | null;
  unlimited?: boolean;
  included_per_period: number;
  included_used: number;
};

export default function LiveVoteEventManager({
  eventId,
  checkoutStatus,
}: {
  eventId: string;
  checkoutStatus: string | null;
}) {
  const supabase = createClient();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [notFoundOrForbidden, setNotFoundOrForbidden] = useState(false);
  const [event, setEvent] = useState<LiveVoteEventDetail | null>(null);
  const [options, setOptions] = useState<LiveVoteOptionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [closing, setClosing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [plan, setPlan] = useState<PlanStatus | null>(null);
  const [addPro, setAddPro] = useState(false);
  const [togglingDemo, setTogglingDemo] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [listing, setListing] = useState(false);
  const [activating, setActivating] = useState(false);

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/live-vote/${eventId}`)}`);
      return;
    }

    const { data: eventRow } = await supabase
      .from("live_vote_events")
      .select("id, organizer_id, title, description, voter_mode, voting_method, scoring_mode, results_released, listed_publicly, pro_enabled, collect_demographics, tier, status, starts_at, closes_at")
      .eq("id", eventId)
      .maybeSingle();

    if (!eventRow || eventRow.organizer_id !== user.id) {
      setNotFoundOrForbidden(true);
      setLoading(false);
      return;
    }

    setEvent(eventRow);

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    setIsAdmin(Boolean(profileRow?.is_admin));

    const { data: optionRows } = await supabase
      .from("live_vote_options")
      .select("id, name, source_type, sort_order")
      .eq("event_id", eventId)
      .order("sort_order");

    setOptions(optionRows ?? []);

    const { data: planData } = await supabase.rpc("organizer_pro_status", {});
    setPlan((planData as PlanStatus | null) ?? null);
    setLoading(false);
  }, [supabase, eventId, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleGoLive() {
    setError(null);
    setCheckingOut(true);
    try {
      const res = await fetch("/api/checkout/live-vote-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, addPro }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong starting checkout.");
      }
      window.location.href = data.url;
    } catch (err) {
      setCheckingOut(false);
      setError(err instanceof Error ? err.message : "Something went wrong starting checkout.");
    }
  }

  async function handleGoLiveFree() {
    setError(null);
    setActivating(true);
    const { error: rpcError } = await supabase.rpc("activate_free_live_vote_event", { p_event_id: eventId });
    setActivating(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    load();
  }

  async function changeTier(next: LiveVoteTier) {
    if (!event || next === event.tier) return;
    setError(null);
    const { error: updError } = await supabase
      .from("live_vote_events")
      .update({ tier: next, price_cents: LIVE_VOTE_TIERS[next].priceCents })
      .eq("id", eventId)
      .eq("status", "draft");
    if (updError) {
      setError(updError.message);
      return;
    }
    load();
  }

  async function handleGoLiveWithPlan() {
    if (!confirm("Use one of your included Organizer Pro events to take this live now?")) return;
    setError(null);
    setActivating(true);
    const { error: rpcError } = await supabase.rpc("activate_live_vote_event_with_plan", { p_event_id: eventId });
    setActivating(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    load();
  }

  async function toggleDemographics() {
    if (!event) return;
    setTogglingDemo(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("set_live_vote_collect_demographics", {
      p_event_id: eventId,
      p_on: !event.collect_demographics,
    });
    setTogglingDemo(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    load();
  }

  async function handleAdminGoLive() {
    if (!confirm("Take this event live now without payment? (Admin comp)")) return;
    setError(null);
    setActivating(true);
    const { error: rpcError } = await supabase.rpc("admin_activate_live_vote_event", {
      p_event_id: eventId,
    });
    setActivating(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    load();
  }

  async function handleDeleteDraft() {
    if (!confirm("Delete this draft event? This can't be undone.")) return;
    await supabase.from("live_vote_events").delete().eq("id", eventId);
    router.push("/live-vote");
  }

  async function handleCloseNow() {
    if (!confirm("Close voting now? Nobody will be able to vote after this.")) return;
    setClosing(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("close_live_vote_event", { p_event_id: eventId });
    setClosing(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    load();
  }

  async function toggleListed() {
    if (!event) return;
    setListing(true);
    setError(null);
    const { error: rpcError } = await supabase.rpc("set_live_vote_listed", {
      p_event_id: eventId,
      p_listed: !event.listed_publicly,
    });
    setListing(false);
    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    load();
  }

  function copyShareLink() {
    const url = `${window.location.origin}/vote/${eventId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (loading) {
    return <p style={{ color: "var(--text-faint)" }}>Loading…</p>;
  }

  if (notFoundOrForbidden || !event) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          Not found
        </h1>
        <p style={{ color: "var(--text-dim)" }}>
          This event doesn&apos;t exist, or you don&apos;t have access to manage it.
        </p>
      </div>
    );
  }

  const tierConfig = LIVE_VOTE_TIERS[event.tier];
  const planActive = Boolean(plan?.active);
  const includedLeft = plan ? Math.max(0, plan.included_per_period - plan.included_used) : 0;
  const isFree = event.tier === "free";
  const planCoversEvent = !isFree && planActive && ORGANIZER_PRO.includedTiers.includes(event.tier) && includedLeft > 0;
  const hasPro = event.pro_enabled || planActive;
  const payTotalCents = tierConfig.priceCents + (addPro && !hasPro ? PRO_ADDON_CENTS : 0);
  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/vote/${event.id}` : "";

  return (
    <div>
      {shareOpen && shareUrl && (
        <ShareEventModal url={shareUrl} title={event.title} onClose={() => setShareOpen(false)} />
      )}
      {checkoutStatus === "success" && event.status === "draft" && (
        <p
          className="mb-6 rounded-lg p-3 text-sm"
          style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}
        >
          Payment received — this event should go live within a moment. Refresh if it still
          shows as a draft.
        </p>
      )}
      {checkoutStatus === "pro_success" && !event.pro_enabled && (
        <p className="mb-6 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
          Payment received — Pro analytics will unlock within a moment. Refresh if you don&apos;t see them yet.
        </p>
      )}
      {checkoutStatus === "cancelled" && (
        <p
          className="mb-6 rounded-lg p-3 text-sm"
          style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}
        >
          Checkout was cancelled — no charge was made.
        </p>
      )}

      <div className="mb-1 flex items-center gap-2">
        <span
          className="rounded-full px-2.5 py-0.5 text-xs font-bold"
          style={{
            background: "var(--surface-2)",
            color: event.status === "live" ? "var(--red)" : "var(--text-dim)",
          }}
        >
          {event.status === "draft" ? "Draft" : event.status === "live" ? "Live" : "Closed"}
        </span>
        <span className="text-xs" style={{ color: "var(--text-faint)" }}>
          {tierConfig.label} tier{hasPro ? " · Pro" : ""} ·{" "}
          {event.scoring_mode === "judges"
            ? "Judges panel"
            : `${event.voter_mode === "account" ? "Account required" : "Open link"}${event.voting_method === "ranked" ? " · Ranked choice" : ""}`}
        </span>
      </div>

      <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        {event.title}
      </h1>
      {event.description && (
        <p className="mb-4 text-sm" style={{ color: "var(--text-faint)" }}>
          {event.description}
        </p>
      )}

      <div className="mb-6 flex flex-col gap-1.5">
        {options.map((o, idx) => (
          <div
            key={o.id}
            className="rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            {idx + 1}. {o.name}
          </div>
        ))}
      </div>

      {event.scoring_mode === "judges" && (
        <JudgePanelManager
          eventId={event.id}
          status={event.status}
          resultsReleased={event.results_released}
          onChanged={load}
          optionNames={Object.fromEntries(options.map((o) => [o.id, o.name]))}
        />
      )}

      {event.scoring_mode === "crowd" && event.voting_method === "ranked" && event.status !== "draft" && (
        <div className="mb-6">
          <RankedResults
            eventId={event.id}
            optionNames={Object.fromEntries(options.map((o) => [o.id, o.name]))}
            status={event.status}
          />
        </div>
      )}

      <label
        className="mb-4 flex cursor-pointer items-start gap-3 rounded-lg border p-3"
        style={{ borderColor: "var(--border)", background: "var(--surface)" }}
      >
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[var(--red)]"
          checked={event.listed_publicly}
          disabled={listing}
          onChange={toggleListed}
        />
        <span className="text-sm">
          <span className="font-semibold">List on the Explore page</span>
          <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
            {event.listed_publicly
              ? "Anyone browsing BoutCasts can find this event while it's live."
              : "Only people with your link can find this event. Leave this off for school and private events."}
          </span>
        </span>
      </label>

      {!isFree && <EventSponsorManager eventId={event.id} editable={event.status !== "closed"} />}

      {event.scoring_mode === "crowd" && event.status !== "closed" && (
        <label
          className="mb-4 flex cursor-pointer items-start gap-3 rounded-lg border p-3"
          style={{ borderColor: "var(--border)", background: "var(--surface)" }}
        >
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 accent-[var(--red)]"
            checked={event.collect_demographics}
            disabled={togglingDemo}
            onChange={toggleDemographics}
          />
          <span className="text-sm">
            <span className="font-semibold">Ask voters optional demographic questions</span>
            <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
              After voting, people can answer age range, gender and race/ethnicity — every question is
              optional with &ldquo;Prefer not to say&rdquo;, only ages 13+, and you only ever see totals
              (groups under 5 are hidden).{hasPro ? "" : " Results need Pro."}
            </span>
          </span>
        </label>
      )}

      {error && (
        <p className="mb-4 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--red)" }}>
          {error}
        </p>
      )}

      {event.status === "draft" && (
        <div className="flex flex-col gap-2">
          <label className="mb-1 flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold">Tier</span>
            <select
              value={event.tier}
              onChange={(e) => changeTier(e.target.value as LiveVoteTier)}
              className="rounded-[10px] border px-3 py-2 text-sm"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              {(Object.keys(LIVE_VOTE_TIERS) as LiveVoteTier[]).map((k) => (
                <option key={k} value={k}>
                  {LIVE_VOTE_TIERS[k].label} — {tierPriceLabel(k)} · up to {LIVE_VOTE_TIERS[k].voteCap.toLocaleString()} votes
                </option>
              ))}
            </select>
          </label>
          {isFree && (
            <button
              onClick={handleGoLiveFree}
              disabled={activating}
              className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60"
            >
              {activating ? "Going live…" : "Go live free"}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={handleAdminGoLive}
              disabled={activating || checkingOut}
              className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60"
            >
              {activating ? "Going live…" : "Go live free (admin)"}
            </button>
          )}
          {planCoversEvent && (
            <button
              onClick={handleGoLiveWithPlan}
              disabled={activating || checkingOut}
              className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60"
            >
              {activating
                ? "Going live…"
                : plan!.unlimited
                  ? `Go live — included in your ${plan!.license ?? "school"} license`
                  : `Go live — included in Organizer Pro (${includedLeft} of ${plan!.included_per_period} left)`}
            </button>
          )}
          {!isFree && !hasPro && event.scoring_mode === "crowd" && (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm" style={{ borderColor: "var(--border)" }}>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--red)]"
                checked={addPro}
                onChange={(e) => setAddPro(e.target.checked)}
              />
              <span>
                Add <b>Pro analytics</b> (+${PRO_ADDON_CENTS / 100}) — turnout over time, demographics, CSV export
              </span>
            </label>
          )}
          {!isFree && (
          <button
            onClick={handleGoLive}
            disabled={checkingOut}
            className={
              planCoversEvent
                ? "rounded-full border px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
                : "bc-btn-solid rounded-full px-5 py-3 text-sm font-bold disabled:opacity-60"
            }
            style={planCoversEvent ? { borderColor: "var(--border)", color: "var(--text-dim)" } : undefined}
          >
            {checkingOut ? "Starting checkout…" : `Go live for $${(payTotalCents / 100).toFixed(0)}`}
          </button>
          )}
          <button
            onClick={handleDeleteDraft}
            className="rounded-full border px-5 py-2.5 text-sm font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
          >
            Delete draft
          </button>
        </div>
      )}

      {event.status === "live" && (
        <div className="flex flex-col gap-3">
          <div
            className="rounded-lg border p-3"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <p className="mb-1 text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-dim)" }}>
              Share this link with your voters
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate text-sm" style={{ color: "var(--text)" }}>
                {shareUrl}
              </code>
              <button
                onClick={copyShareLink}
                className="rounded-full border px-3 py-1 text-xs font-bold"
                style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <button
              onClick={() => setShareOpen(true)}
              className="bc-btn-solid mt-2.5 w-full rounded-full px-4 py-2.5 text-sm font-bold"
            >
              QR code &amp; share options
            </button>
          </div>
          {event.closes_at && (
            <p className="text-xs" style={{ color: "var(--text-faint)" }}>
              Voting closes {new Date(event.closes_at).toLocaleString()}
            </p>
          )}
          <button
            onClick={handleCloseNow}
            disabled={closing}
            className="rounded-full border px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
          >
            {closing ? "Closing…" : "Close voting now"}
          </button>
        </div>
      )}

      {event.status === "closed" && (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-lg border p-3"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          >
            <p className="text-sm" style={{ color: "var(--text-dim)" }}>
              Voting has closed.{" "}
              <a href={shareUrl} className="font-semibold underline" style={{ color: "var(--red)" }}>
                View the final tally
              </a>
              .
            </p>
          </div>

        </div>
      )}

      {event.scoring_mode === "crowd" && event.status !== "draft" && (
        <div className="mt-6">
          <LiveVoteAnalyticsPanel eventId={event.id} eventTitle={event.title} />
        </div>
      )}
    </div>
  );
}
