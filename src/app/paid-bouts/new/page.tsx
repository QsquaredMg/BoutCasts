import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PAID_BOUTS_ENABLED } from "@/lib/features";
import PaidBoutForm from "@/components/PaidBoutForm";

export const metadata: Metadata = { title: "Create a paid bout", robots: { index: false } };

export default async function NewPaidBoutPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const { data: profile } = userData.user
    ? await supabase.from("profiles").select("is_admin").eq("id", userData.user.id).maybeSingle()
    : { data: null };
  const isAdmin = profile?.is_admin === true;

  return (
    <div className="mx-auto max-w-2xl px-5 py-8">
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>Create a paid bout</h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Set an entry fee, publish your rules and prizes, and invite competitors. BoutCasts keeps 20% of entry fees; prizes are paid
        next; you are paid the rest.
      </p>
      {!userData.user ? (
        <p className="text-sm">
          <Link href="/login?next=/paid-bouts/new" className="font-semibold underline">Sign in</Link> to create a paid bout.
        </p>
      ) : !isAdmin && !PAID_BOUTS_ENABLED ? (
        <p className="rounded-lg p-3 text-sm" style={{ background: "var(--surface-2)", color: "var(--text-dim)" }}>
          Paid bouts aren&apos;t open to organizers yet. <Link href="/host" className="font-semibold underline">Contact us</Link> and we&apos;ll set one up with you.
        </p>
      ) : (
        <PaidBoutForm isAdmin={isAdmin} />
      )}
    </div>
  );
}
