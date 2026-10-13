import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";

// Permanently deletes the signed-in user's account (required by the App Store
// and Google Play). Order matters:
//   1. Refuse while money is still in motion (paid bouts, payouts, org license).
//   2. Cancel any Stripe subscription so nobody is billed after deletion.
//   3. Delete the auth user; the database cascades the rest of their data and
//      keeps anonymized financial records (see docs/sql/account_deletion_blocking.sql).
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (body?.confirm !== "DELETE") {
    return NextResponse.json({ error: 'Type "DELETE" to confirm' }, { status: 400 });
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Account deletion isn't available right now. Contact support@boutcasts.com." }, { status: 503 });
  }

  const { data: blockers, error: blockErr } = await admin.rpc("account_deletion_blockers", { p_uid: user.id });
  if (blockErr) {
    console.error("account delete: blockers check failed", blockErr.message);
    return NextResponse.json({ error: "Couldn't check your account. Please try again." }, { status: 500 });
  }
  if (Array.isArray(blockers) && blockers.length > 0) {
    return NextResponse.json(
      { error: "Please settle these before deleting your account.", blockers },
      { status: 409 }
    );
  }

  // Cancel billing first. If Stripe fails for any reason other than "already gone",
  // stop: deleting the account while a subscription keeps billing would be worse.
  const [{ data: subRows }, { data: orgRows }] = await Promise.all([
    admin.from("organizer_subscriptions").select("stripe_subscription_id").eq("user_id", user.id),
    admin.from("organizations").select("stripe_subscription_id").eq("owner_id", user.id),
  ]);
  const subscriptionIds = [...(subRows ?? []), ...(orgRows ?? [])]
    .map((r) => r.stripe_subscription_id as string | null)
    .filter((id): id is string => !!id);

  if (subscriptionIds.length > 0) {
    try {
      const stripe = getStripe();
      for (const id of subscriptionIds) {
        try {
          await stripe.subscriptions.cancel(id);
        } catch (e) {
          const err = e as { code?: string; statusCode?: number };
          // Already canceled / never existed in this mode: fine.
          if (err.code === "resource_missing" || err.statusCode === 404) continue;
          throw e;
        }
      }
    } catch (e) {
      console.error("account delete: stripe cancel failed", (e as Error).message);
      return NextResponse.json(
        { error: "We couldn't cancel your subscription, so your account was not deleted. Try again or contact support@boutcasts.com." },
        { status: 502 }
      );
    }
  }

  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    console.error("account delete: deleteUser failed", delErr.message);
    return NextResponse.json({ error: "Couldn't delete your account. Please contact support@boutcasts.com." }, { status: 500 });
  }

  // The session is gone with the user; clear the cookies too.
  await supabase.auth.signOut().catch(() => {});
  return NextResponse.json({ ok: true });
}
