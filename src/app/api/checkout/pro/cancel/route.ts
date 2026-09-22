import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.stripe_subscription_id) {
    return NextResponse.json({ error: "No active membership found" }, { status: 400 });
  }

  const stripe = getStripe();
  await stripe.subscriptions.cancel(profile.stripe_subscription_id);

  const admin = createAdminClient();
  await admin
    .from("profiles")
    .update({ tier: "fan", stripe_subscription_id: null, pro_active_until: null })
    .eq("id", user.id);

  return NextResponse.json({ ok: true });
}
