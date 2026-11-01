import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { schoolRolesActive } from "@/lib/schoolElection";
import { SCHOOL_ROLES_PLAN } from "@/lib/liveVoteEvents/tiers";

// Start the annual Student Roles plan. The webhook records it in school_role_plans once Stripe confirms.
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  if (await schoolRolesActive(createAdminClient(), user.id)) {
    return NextResponse.json({ error: "You already have the Student Roles plan." }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const back = typeof body?.electionId === "string" && /^[0-9a-f-]{36}$/i.test(body.electionId) ? `/school-election/${body.electionId}` : "/school-election";
  const origin = req.headers.get("origin") ?? new URL(req.url).origin;
  try {
    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: "BoutCasts School Elections: Student Roles",
              description: "Student election roles with role codes, mini lessons and role cards. Unlimited elections for one school year.",
            },
            unit_amount: SCHOOL_ROLES_PLAN.priceCents,
            recurring: { interval: "year" },
          },
          quantity: 1,
        },
      ],
      subscription_data: { metadata: { kind: "school_roles", user_id: user.id } },
      success_url: `${origin}${back}?roles=success`,
      cancel_url: `${origin}${back}?roles=cancelled`,
      metadata: { kind: "school_roles", user_id: user.id },
    });
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("school-roles: Stripe error", err);
    return NextResponse.json({ error: "Checkout is unavailable right now. Please try again." }, { status: 502 });
  }
}
