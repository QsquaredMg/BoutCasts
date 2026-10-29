import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import InviteAccept from "@/components/InviteAccept";
import { KIND_LABEL, type EventKind } from "@/lib/eventRoles";

export const metadata: Metadata = { title: "Invitation", robots: { index: false } };

type Invite = {
  id: string;
  kind: EventKind;
  role: "moderator" | "owner";
  title: string | null;
  invited_by: string | null;
  email: string;
  status: "pending" | "active" | "declined" | "revoked" | "completed" | "expired";
};

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data } = /^[0-9a-f]{64}$/.test(token) ? await supabase.rpc("get_event_invite", { p_token: token }) : { data: null };
  const inv = data as Invite | null;
  const here = `/invite/${token}`;

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      {!inv ? (
        <>
          <h1 className="text-2xl font-extrabold">Invitation not found</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>This link isn&apos;t valid. Ask the person who invited you to send a new one.</p>
        </>
      ) : inv.status !== "pending" ? (
        <>
          <h1 className="text-2xl font-extrabold">This invitation is no longer open</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
            {inv.status === "expired" ? "It expired. Ask for a new one." : inv.status === "active" || inv.status === "completed" ? "It was already accepted." : "It was cancelled or declined."}
          </p>
        </>
      ) : (
        <>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>Invitation</p>
          <h1 className="mt-1 text-2xl font-extrabold">
            {inv.role === "owner" ? "Take over" : "Help run"} &ldquo;{inv.title ?? "this event"}&rdquo;
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--text-dim)" }}>
            {inv.invited_by ? `@${inv.invited_by} invited` : "You were invited"} <b>{inv.email}</b> to {inv.role === "owner" ? "become the owner of" : "moderate"} this {KIND_LABEL[inv.kind]}.
            {inv.role === "moderator" ? " Moderators run the event but don't see payments or earnings." : " You will manage everything, including billing and earnings from now on."}
          </p>
          {!auth.user ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/login?next=${encodeURIComponent(here)}`} className="bc-btn-solid rounded-full px-5 py-2.5 text-sm font-bold">Sign in</Link>
              <Link href={`/signup?next=${encodeURIComponent(here)}`} className="rounded-full border px-5 py-2.5 text-sm font-bold" style={{ borderColor: "var(--border)" }}>Create an account</Link>
              <p className="w-full text-xs" style={{ color: "var(--text-faint)" }}>Use the email address <b>{inv.email}</b>.</p>
            </div>
          ) : auth.user.email?.toLowerCase() !== inv.email ? (
            <p className="mt-5 rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
              You are signed in as {auth.user.email}, but this invitation is for <b>{inv.email}</b>. Sign out and sign in with that address.
            </p>
          ) : (
            <InviteAccept token={token} kind={inv.kind} role={inv.role} />
          )}
        </>
      )}
    </div>
  );
}
