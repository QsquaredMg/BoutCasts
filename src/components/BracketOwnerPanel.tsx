"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LocalTime from "@/components/LocalTime";
import { BRACKET_PRICING, money } from "@/lib/predictions/pricing";
import type { PredSlate } from "@/lib/predictions/types";

// Owner controls for a bracket: pay, upgrade, set a close time, close now.
export default function BracketOwnerPanel({ slate, justPaid, isAdmin = false, gameCount = 1 }: { slate: PredSlate; justPaid: boolean; isAdmin?: boolean; gameCount?: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [when, setWhen] = useState("");
  const isPrivate = slate.tier === "private";
  const privateCents = BRACKET_PRICING.privateGameCents * Math.max(gameCount, 1);

  // After checkout the Stripe webhook opens the bracket a moment later.
  useEffect(() => {
    if (!(justPaid && slate.status === "pending")) return;
    const t = setInterval(() => router.refresh(), 3000);
    const stop = setTimeout(() => clearInterval(t), 60000);
    return () => {
      clearInterval(t);
      clearTimeout(stop);
    };
  }, [justPaid, slate.status, router]);

  async function pay(mode: "activate" | "upgrade", tier?: "weekly" | "season") {
    setBusy(true);
    setMsg(null);
    const resp = await fetch("/api/checkout/prediction-bracket", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bracketId: slate.id, mode, tier }),
    });
    const out = await resp.json().catch(() => ({}));
    if (!resp.ok || !out.url) {
      setBusy(false);
      setMsg(out.error ?? "We couldn't start checkout.");
      return;
    }
    window.location.assign(out.url);
  }

  async function rpc(name: "close_pred_bracket" | "set_pred_bracket_close_time" | "admin_open_pred_bracket" | "admin_reopen_pred_bracket", args: Record<string, unknown>, ok: string) {
    setBusy(true);
    setMsg(null);
    const { error } = await createClient().rpc(name, args);
    setBusy(false);
    setMsg(error ? error.message : ok);
    if (!error) router.refresh();
  }

  const btn = "rounded-full border px-4 py-2.5 text-sm font-semibold disabled:opacity-50";
  const border = { borderColor: "var(--border)" };

  return (
    <div className="bc-card mb-6 p-5">
      <h2 className="mb-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>{isPrivate ? "Private game settings" : "Bracket settings"}</h2>

      {slate.status === "pending" && (
        <>
          {justPaid ? (
            <p className="text-sm font-semibold" style={{ color: "var(--blue)" }}>Payment received. Opening your bracket…</p>
          ) : (
            <>
              <p className="mb-3 text-sm" style={{ color: "var(--text-dim)" }}>
                {isPrivate ? "This private game is saved but not open yet. Check out to get your invite code and link. Your invitees play free." : "This bracket is saved but not open yet. Players can't see it until you check out."}
              </p>
              {isPrivate ? (
                <button type="button" disabled={busy} onClick={() => pay("activate")} className="bc-btn-solid w-full rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-60">
                  {money(privateCents)} · {gameCount} {gameCount === 1 ? "game" : "games"} × {money(BRACKET_PRICING.privateGameCents)}
                </button>
              ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <button type="button" disabled={busy} onClick={() => pay("activate", "weekly")} className="bc-btn-solid rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-60">
                  {money(BRACKET_PRICING.weeklyCents)} · open 8 days
                </button>
                <button type="button" disabled={busy} onClick={() => pay("activate", "season")} className={btn} style={border}>
                  {money(BRACKET_PRICING.seasonCents)} · whole season
                </button>
              </div>
              )}
              {isAdmin && (
                <button type="button" disabled={busy} onClick={() => rpc("admin_open_pred_bracket", { p_id: slate.id, p_tier: isPrivate ? "private" : "season" }, "Bracket opened (free).")} className={`${btn} mt-2 w-full`} style={border}>
                  Admin: open for free
                </button>
              )}
            </>
          )}
        </>
      )}

      {slate.status === "open" && (
        <>
          {isPrivate && slate.invite_code && <InviteBox slateId={slate.id} code={slate.invite_code} />}
          <p className="mb-3 text-sm" style={{ color: "var(--text-dim)" }}>
            {isPrivate ? (
              <>Private game. Only people with your link or code can find it, and it stays out of public lists and leaderboards.</>
            ) : slate.tier === "weekly" ? (
              <>8-day bracket. It closes automatically {slate.closes_at ? <LocalTime iso={slate.closes_at} /> : "after 8 days"}.</>
            ) : slate.closes_at ? (
              <>Season bracket. It closes automatically <LocalTime iso={slate.closes_at} />.</>
            ) : (
              <>Season bracket. It stays open until you close it or set a close time.</>
            )}
          </p>
          {isPrivate ? null : slate.tier === "weekly" ? (
            <button type="button" disabled={busy} onClick={() => pay("upgrade")} className="bc-btn-solid mb-2 w-full rounded-full px-4 py-2.5 text-sm font-bold disabled:opacity-60">
              Upgrade to season bracket · {money(BRACKET_PRICING.upgradeCents)}
            </button>
          ) : (
            <div className="mb-2 flex flex-wrap items-end gap-2">
              <label className="min-w-0 flex-1 text-xs font-bold">
                Close automatically at
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-transparent px-3 text-sm" style={border} />
              </label>
              <button type="button" disabled={busy || !when} onClick={() => rpc("set_pred_bracket_close_time", { p_id: slate.id, p_closes_at: new Date(when).toISOString() }, "Close time saved.")} className={btn} style={border}>Save</button>
              {slate.closes_at && (
                <button type="button" disabled={busy} onClick={() => rpc("set_pred_bracket_close_time", { p_id: slate.id, p_closes_at: null }, "Close time removed.")} className={btn} style={border}>Clear</button>
              )}
            </div>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm("Close this bracket? Players can no longer make predictions in it.")) rpc("close_pred_bracket", { p_id: slate.id }, "Bracket closed.");
            }}
            className={btn}
            style={{ ...border, color: "var(--red)" }}
          >
            Close bracket now
          </button>
        </>
      )}

      {slate.status === "closed" && (
        <>
          <p className="mb-2 text-sm" style={{ color: "var(--text-dim)" }}>
            This bracket is closed to new predictions. You can still enter final scores so everyone gets graded.
          </p>
          {slate.tier === "weekly" && (
            <button type="button" disabled={busy} onClick={() => pay("upgrade")} className={btn} style={border}>
              Reopen as a season bracket · {money(BRACKET_PRICING.upgradeCents)}
            </button>
          )}
          {isAdmin && (
            <button type="button" disabled={busy} onClick={() => rpc("admin_reopen_pred_bracket", { p_id: slate.id }, "Bracket reopened.")} className={`${btn} ml-2`} style={border}>
              Admin: reopen
            </button>
          )}
        </>
      )}
      {msg && <p role="status" className="mt-3 text-sm font-semibold" style={{ color: "var(--text-dim)" }}>{msg}</p>}
    </div>
  );
}

function InviteBox({ slateId, code }: { slateId: string; code: string }) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  async function copy(kind: "link" | "code") {
    const text = kind === "code" ? code : `${window.location.origin}/predictions/slate/${slateId}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // clipboard blocked: the code is visible on screen anyway
    }
  }
  return (
    <div className="mb-4 rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>Invite code</p>
      <p className="my-1 text-3xl font-black tracking-[0.3em]" style={{ fontFamily: "var(--font-display)" }}>{code}</p>
      <p className="mb-3 text-xs" style={{ color: "var(--text-dim)" }}>Friends can enter this code at boutcasts.com/predictions/join, or just open your private link.</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => copy("link")} className="bc-btn-solid rounded-full px-4 py-2 text-xs font-bold">{copied === "link" ? "Link copied!" : "Copy private link"}</button>
        <button type="button" onClick={() => copy("code")} className="rounded-full border px-4 py-2 text-xs font-bold" style={{ borderColor: "var(--border)" }}>{copied === "code" ? "Code copied!" : "Copy code"}</button>
      </div>
    </div>
  );
}
