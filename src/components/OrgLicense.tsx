"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ORG_LICENSE } from "@/lib/liveVoteEvents/tiers";

// School & League License: sign up (annual), or — for members — the shared
// dashboard: license status, staff seats and invite link, and everyone's events.

type Org = {
  id: string;
  name: string;
  owner_id: string;
  seats: number;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  invite_token: string;
};
type Dashboard = {
  members: { user_id: string; role: string; username: string | null; joined_at: string }[];
  events: { id: string; title: string; status: string; tier: string; organizer: string | null; created_at: string }[];
};

const ACTIVE = ["active", "trialing", "comp"];

export default function OrgLicense() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [org, setOrg] = useState<Org | null>(null);
  const [dash, setDash] = useState<Dashboard | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    setUserId(u.user?.id ?? null);
    if (!u.user) return;
    const { data: m } = await supabase.from("organization_members").select("org_id").eq("user_id", u.user.id).limit(1).maybeSingle();
    if (!m) {
      setOrg(null);
      return;
    }
    const { data: o } = await supabase
      .from("organizations")
      .select("id, name, owner_id, seats, status, current_period_end, cancel_at_period_end, invite_token")
      .eq("id", m.org_id)
      .maybeSingle();
    setOrg(o);
    if (o) {
      setName(o.name);
      const { data: d } = await supabase.rpc("get_org_dashboard", { p_org_id: o.id });
      setDash(d as Dashboard);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const p = new URLSearchParams(window.location.search).get("license");
    if (p === "success") setNotice("Payment received — your license activates within a moment. Refresh if it still shows as pending.");
    if (p === "cancelled") setNotice("Checkout was cancelled — no charge was made.");
  }, [load]);

  async function post(path: string, body: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      window.location.assign(data.url);
    } catch (err) {
      setBusy(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function removeMember(uid: string) {
    if (!org || !confirm("Remove this staff member from the license?")) return;
    const { error: rpcError } = await supabase.rpc("org_remove_member", { p_org_id: org.id, p_user_id: uid });
    if (rpcError) setError(rpcError.message);
    load();
  }

  async function resetInvite() {
    if (!org || !confirm("Make a new invite link? The old one will stop working.")) return;
    await supabase.rpc("org_reset_invite", { p_org_id: org.id });
    load();
  }

  const box = { borderColor: "var(--border)", background: "var(--surface)" };
  const h = "mb-2 text-xs font-bold uppercase tracking-wide";
  const price = `$${(ORG_LICENSE.priceCents / 100).toLocaleString()}`;

  if (userId === undefined) return <p style={{ color: "var(--text-faint)" }}>Loading…</p>;

  const pitch = (
    <>
      <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--red)" }}>
        Schools · districts · leagues
      </p>
      <h1 className="mb-2 text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        School &amp; League License
      </h1>
      <p className="mb-4 text-sm" style={{ color: "var(--text-dim)" }}>
        One annual license for everyone who runs votes and competitions — class elections, homecoming,
        spirit weeks, talent shows, league brackets.
      </p>
      <div className="mb-5 rounded-xl border p-5" style={{ ...box, borderColor: "var(--red)" }}>
        <p className="text-3xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {price}
          <span className="text-sm font-semibold" style={{ color: "var(--text-faint)" }}>
            /year
          </span>
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm" style={{ color: "var(--text-dim)" }}>
          <li>✓ {ORG_LICENSE.seats} staff accounts — each runs their own events</li>
          <li>✓ Unlimited Small &amp; Medium Live Votes (up to 5,000 votes each)</li>
          <li>✓ Pro analytics, CSV export and white-label on every event</li>
          <li>✓ Ranked choice, judges panels, bracket competitions</li>
          <li>✓ Large (50,000-vote) events at the regular per-event price</li>
          <li>✓ Pay by card now — need an invoice or purchase order? Email support@boutcasts.com</li>
        </ul>
      </div>
    </>
  );

  if (!userId) {
    return (
      <div>
        {pitch}
        <Link href="/login?next=%2Forg" className="bc-btn-solid inline-block rounded-full px-6 py-3 text-sm font-bold">
          Sign in to get started
        </Link>
      </div>
    );
  }

  const active = org && ACTIVE.includes(org.status) && (!org.current_period_end || new Date(org.current_period_end) > new Date());
  const isOwner = org && org.owner_id === userId;

  if (!org || (!active && isOwner && org.status === "pending")) {
    return (
      <div>
        {pitch}
        {notice && (
          <p className="mb-3 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
            {notice}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <input
            className="w-full rounded-[10px] border px-3.5 py-2.5 text-sm"
            style={box}
            placeholder="School, district or league name"
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            onClick={() => post("/api/checkout/org-license", { name })}
            disabled={busy || name.trim().length < 2}
            className="bc-btn-solid rounded-full px-6 py-3 text-sm font-bold disabled:opacity-60"
          >
            {busy ? "Starting checkout…" : `Get the license — ${price}/year`}
          </button>
          {error && (
            <p className="text-sm" style={{ color: "var(--red)" }}>
              {error}
            </p>
          )}
        </div>
      </div>
    );
  }

  const inviteUrl = typeof window !== "undefined" ? `${window.location.origin}/org/join/${org.invite_token}` : "";
  const members = dash?.members ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color: "var(--red)" }}>
          School &amp; League License
        </p>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
          {org.name}
        </h1>
        <p className="text-sm" style={{ color: active ? "var(--text-dim)" : "var(--red)" }}>
          {active
            ? `Active${org.status === "comp" ? " (complimentary)" : ""}${org.current_period_end ? ` · ${org.cancel_at_period_end ? "ends" : "renews"} ${new Date(org.current_period_end).toLocaleDateString()}` : ""}`
            : `License is ${org.status.replace("_", " ")} — staff benefits are paused.`}
        </p>
      </div>
      {notice && (
        <p className="rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
          {notice}
        </p>
      )}

      <div className="rounded-xl border p-3.5" style={box}>
        <p className={h} style={{ color: "var(--text-dim)" }}>
          Staff ({members.length}/{org.seats} seats)
        </p>
        <ul className="mb-3 flex flex-col gap-1.5">
          {members.map((m) => (
            <li key={m.user_id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                <b>{m.username ?? "Member"}</b>{" "}
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {m.role === "owner" ? "owner" : `joined ${new Date(m.joined_at).toLocaleDateString()}`}
                </span>
              </span>
              {isOwner && m.role !== "owner" && (
                <button onClick={() => removeMember(m.user_id)} className="text-xs underline" style={{ color: "var(--text-faint)" }}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        {isOwner && (
          <>
            <p className="mb-1 text-xs" style={{ color: "var(--text-faint)" }}>
              Send this invite link to staff (they sign in or create a free account, then join):
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "var(--border)" }}>
                {inviteUrl}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(inviteUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); })}
                className="rounded-full border px-3 py-1.5 text-xs font-bold"
                style={{ borderColor: "var(--border)" }}
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <button onClick={resetInvite} className="mt-2 text-xs underline" style={{ color: "var(--text-faint)" }}>
              Make a new link (stops the old one)
            </button>
          </>
        )}
      </div>

      <div className="rounded-xl border p-3.5" style={box}>
        <p className={h} style={{ color: "var(--text-dim)" }}>
          Staff events this year ({dash?.events.length ?? 0})
        </p>
        {(dash?.events.length ?? 0) === 0 ? (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            No events yet.{" "}
            <Link href="/live-vote/new" className="font-semibold underline" style={{ color: "var(--red)" }}>
              Create a Live Vote
            </Link>
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {dash!.events.map((e) => (
              <li key={e.id} className="flex justify-between gap-2 text-sm">
                <Link href={`/vote/${e.id}`} className="truncate hover:underline">
                  {e.title}
                </Link>
                <span className="shrink-0 text-xs" style={{ color: e.status === "live" ? "var(--red)" : "var(--text-faint)" }}>
                  {e.organizer} · {e.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/live-vote/new" className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold">
          New Live Vote
        </Link>
        <Link href="/competitions" className="rounded-full border px-5 py-2.5 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>
          Competitions
        </Link>
        {isOwner && org.status !== "comp" && (
          <button
            onClick={() => post("/api/billing/portal", { kind: "org_license" })}
            disabled={busy}
            className="rounded-full border px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
            style={{ borderColor: "var(--border)" }}
          >
            Manage billing
          </button>
        )}
        {!isOwner && (
          <button onClick={() => removeMember(userId)} className="text-xs underline" style={{ color: "var(--text-faint)" }}>
            Leave this license
          </button>
        )}
      </div>
      {error && (
        <p className="text-sm" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
