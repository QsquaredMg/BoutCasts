import ShareButton from "@/components/ShareButton";
import { cardMetadata } from "@/lib/og/cardRoute";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PaidBoutTerms from "@/components/PaidBoutTerms";
import PaidBoutEnter from "@/components/PaidBoutEnter";
import PaidBoutManager, { type ManagerEntry, type ManagerInvite, type ManagerPayout, type ManagerPrize } from "@/components/PaidBoutManager";
import { money, STATUS_LABEL, type PaidBoutStatus } from "@/lib/paidBouts";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { data } = await (await createClient()).from("paid_bouts").select("title").eq("id", id).maybeSingle();
  return cardMetadata("paidbout", id, data?.title ?? "Paid bout");
}

export default async function PaidBoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ invite?: string; checkout?: string }>;
}) {
  const { id } = await params;
  const { invite, checkout } = await searchParams;
  const supabase = await createClient();

  const { data: bout } = await supabase.from("paid_bouts").select("*").eq("id", id).maybeSingle();
  if (!bout) notFound();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  const { data: profile } = user ? await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle() : { data: null };
  const isAdmin = profile?.is_admin === true;
  const isOrganizer = user?.id === bout.organizer_id;
  const canManage = isOrganizer || isAdmin;
  const status = bout.status as PaidBoutStatus;

  const [{ data: prizes }, { data: stats }, { data: organizer }] = await Promise.all([
    supabase.from("paid_bout_prizes").select("id, place, amount_cents, winner_entry_id").eq("bout_id", id).order("place"),
    supabase.rpc("paid_bout_public_stats", { p_bout: id }),
    supabase.from("profiles").select("username").eq("id", bout.organizer_id).maybeSingle(),
  ]);
  const prizeList = (prizes ?? []) as ManagerPrize[];
  const paidEntries = (Array.isArray(stats) ? stats[0]?.paid_entries : stats?.paid_entries) ?? 0;
  const deadline = new Date(bout.entry_deadline);
  const deadlinePassed = Date.now() > deadline.getTime();

  const { data: mine } = user
    ? await supabase.from("paid_bout_entries").select("status").eq("bout_id", id).eq("user_id", user.id).maybeSingle()
    : { data: null };

  let manager: React.ReactNode = null;
  if (canManage) {
    const [{ data: entries }, { data: payouts }, { data: invites }] = await Promise.all([
      supabase
        .from("paid_bout_entries")
        .select("id, entry_title, entry_url, status, profiles(username)")
        .eq("bout_id", id)
        .order("created_at"),
      supabase.from("paid_bout_payouts").select("id, seq, kind, place, amount_cents, status, method, recipient_id").eq("bout_id", id).order("seq"),
      supabase.from("paid_bout_invites").select("email, status").eq("bout_id", id).order("created_at"),
    ]);
    const name = (p: unknown) => (Array.isArray(p) ? p[0]?.username : (p as { username?: string } | null)?.username) ?? null;
    const entryRows: ManagerEntry[] = (entries ?? []).map((e) => ({
      id: e.id,
      username: name(e.profiles),
      entry_title: e.entry_title,
      entry_url: e.entry_url,
      status: e.status,
    }));
    const recipientIds = Array.from(new Set((payouts ?? []).map((p) => p.recipient_id).filter(Boolean)));
    const { data: recips } = recipientIds.length
      ? await supabase.from("profiles").select("id, username").in("id", recipientIds)
      : { data: [] as { id: string; username: string }[] };
    const byId = new Map((recips ?? []).map((r) => [r.id, r.username]));
    const payoutRows: ManagerPayout[] = (payouts ?? []).map((p) => ({
      id: p.id,
      seq: p.seq,
      kind: p.kind,
      place: p.place,
      amount_cents: p.amount_cents,
      status: p.status,
      method: p.method,
      recipient: p.recipient_id ? byId.get(p.recipient_id) ?? null : null,
    }));
    manager = (
      <PaidBoutManager
        boutId={id}
        status={status}
        deadlinePassed={deadlinePassed}
        isAdmin={isAdmin}
        entries={entryRows}
        prizes={prizeList}
        payouts={payoutRows}
        invites={(invites ?? []) as ManagerInvite[]}
      />
    );
  }

  const canEnter = status === "open" && !deadlinePassed && !isOrganizer && mine?.status !== "paid";

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-5 py-8">
      <div>
        <Link href="/paid-bouts" className="mb-3 inline-block text-sm font-semibold" style={{ color: "var(--blue)" }}>
          &larr; All paid bouts
        </Link>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>{bout.title}</h1>
          {bout.status !== "draft" && !bout.invite_only && (
            <ShareButton imageUrl={`/api/share-card/paidbout/${id}`} title={bout.title} text={`${bout.title} — enter the Paid Bout on BoutCasts!`} />
          )}
          <span className="rounded px-2 py-0.5 text-xs font-bold uppercase" style={{ background: "var(--surface-2)" }}>{STATUS_LABEL[status]}</span>
        </div>
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>
          Run by {organizer?.username ?? "an organizer"} · Entry {money(bout.entry_fee_cents)} · Entries close{" "}
          {deadline.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })} · {paidEntries} entered
          {bout.max_entries ? ` of ${bout.max_entries}` : ""} · needs {bout.min_entries} to run
        </p>
        {bout.description && <p className="mt-3 text-sm">{bout.description}</p>}
      </div>

      {checkout === "success" && (
        <p className="rounded-lg p-3 text-sm" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>
          Payment received. Your entry shows here once it&apos;s confirmed, usually within a minute.
        </p>
      )}
      {checkout === "cancelled" && (
        <p className="rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
          Checkout was cancelled. You weren&apos;t charged.
        </p>
      )}
      {mine?.status === "paid" && (
        <p className="rounded-lg p-3 text-sm font-semibold" style={{ background: "var(--gold-soft)", color: "var(--gold)" }}>You&apos;re entered.</p>
      )}
      {mine?.status === "refunded" && (
        <p className="rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>Your entry fee was refunded.</p>
      )}
      {status === "cancelled" && bout.cancelled_reason && (
        <p className="rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
          This bout was cancelled: {bout.cancelled_reason}. Entry fees were refunded.
        </p>
      )}

      <section>
        <h2 className="mb-2 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Prizes</h2>
        <ul className="text-sm">
          {prizeList.map((p) => (
            <li key={p.id} className="flex justify-between border-b py-1.5" style={{ borderColor: "var(--border)" }}>
              <span>Place {p.place}</span>
              <span className="font-semibold">{money(p.amount_cents)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Rules</h2>
        <p className="whitespace-pre-wrap text-sm">{bout.rules}</p>
      </section>

      <section>
        <h2 className="mb-2 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>How winners are chosen</h2>
        <p className="whitespace-pre-wrap text-sm">{bout.judging}</p>
      </section>

      <PaidBoutTerms feeCents={bout.entry_fee_cents} minEntries={bout.min_entries} prizes={prizeList} />

      {canEnter && (
        <PaidBoutEnter boutId={id} feeCents={bout.entry_fee_cents} signedIn={Boolean(user)} inviteToken={invite ?? null} inviteOnly={bout.invite_only} />
      )}

      {manager}
    </div>
  );
}
