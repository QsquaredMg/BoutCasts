# Setup checklists (things only the account owner can click through)

Last checked against the live accounts on 2026-10-29. "Verified" means I read it from the account; everything else is a step for you.

## 1. Resend (email)
**Verified**
- Sending domains `boutcasts.com`, `in.boutcasts.com`, `karts2me.com` are all verified.
- `in.boutcasts.com` has Receiving turned on, and a webhook sends `email.received` to `https://www.boutcasts.com/api/resend/inbound` (enabled).
- `boutcasts.com` itself has Receiving off. That is correct while your real mailboxes (info@, support@) live at GoDaddy. Turning it on would send that mail to Resend instead of GoDaddy.

**To do**
1. Decide how mail reaches the app: either (a) forward info@/support@ from GoDaddy to an address at `in.boutcasts.com` (e.g. `support@in.boutcasts.com`), or (b) move the MX records of `boutcasts.com` to Resend (you would lose the GoDaddy/Outlook mailboxes).
2. Send a test email to the `in.boutcasts.com` address and confirm it appears in the app inbox.
3. Vercel env vars: `RESEND_API_KEY` and (optional) `RESEND_FROM="BoutCasts <info@boutcasts.com>"`. Without the key, invite emails and school election code emails are skipped (the app shows a link/CSV instead).

## 2. Google sign-in
1. Google Cloud Console → APIs & Services → OAuth consent screen: set the app name, support email, logo, add `boutcasts.com` as an authorized domain, add privacy (`https://www.boutcasts.com/privacy`) and terms (`/terms`) links, and **Publish app** (Testing mode limits sign-in to 100 listed test users and tokens expire in 7 days).
2. Credentials → your OAuth client: Authorized redirect URI must include `https://miggnsscufmqfqybblcm.supabase.co/auth/v1/callback`. Authorized JavaScript origins: `https://www.boutcasts.com`.
3. Supabase → Authentication → Providers → Google: paste the Client ID and Secret, enabled.
4. Supabase → Authentication → URL Configuration: Site URL `https://www.boutcasts.com`; Redirect URLs include `https://www.boutcasts.com/**` (and your Vercel preview pattern if you use previews).
5. Test: sign in with a Google account that is not yours, on a phone.

## 3. Meta / Instagram
1. Convert the BoutCasts Instagram to a Business or Creator account and link it to the Facebook page (Instagram → Settings → Account type; Facebook Page → Linked accounts).
2. Create a Meta Business portfolio (business.facebook.com) and add the page and Instagram account as assets. Complete Business Verification if you plan to use the API for posting.
3. For automatic posting: create an app at developers.facebook.com (type Business), add Instagram Graph API, add yourself as a tester, and request `instagram_content_publish` and `pages_manage_posts` (needs App Review with a screencast).
4. Until review is approved, post by hand or with a scheduler (Meta Business Suite). Posting only admin-curated bouts is your standing rule; auto-posts stay off until then.

## 4. Stripe
**Verified (live mode, account "QSquared llc")**
- Webhook `https://www.boutcasts.com/api/stripe/webhook` is enabled for `checkout.session.completed`, `customer.subscription.created/updated/deleted`.
- Other endpoints on the account (landrollleader.com, Kart2Me, an old FreshMember one) belong to other projects. The old FreshMember endpoint (one still enabled with all events) is worth removing if that site is retired.

**To do**
1. Make sure the signing secret of the BoutCasts endpoint is set in Vercel as `STRIPE_WEBHOOK_SECRET`.
2. Turn on Stripe Radar rules for card testing, and enable email receipts (Settings → Emails).
3. Paid Bouts payouts (see `PAID_BOUTS_LEGAL_BRIEF.md`): do not enable payouts to organizers until counsel has reviewed.
4. Before a school launch, run one real $ test checkout end to end and refund it.

## 5. Load test (stadium-scale)
The script already exists: `scripts/loadtest/live-vote-spike.mjs`. It refuses to run against boutcasts.com.
1. Create a **staging** Supabase project and a Vercel **preview** deployment pointing at it (copy the schema by running the files in `docs/sql/`).
2. Create a Large open-link live vote on staging and note its id.
3. `SUPABASE_URL=… SUPABASE_ANON_KEY=… EVENT_ID=… SITE_URL=<preview url> VOTERS=2000 node scripts/loadtest/live-vote-spike.mjs` — then 5,000 and 10,000.
4. Pass bar: vote p95 under 1 s, tally p95 under 0.5 s, under 1% errors. Watch the Supabase database and Realtime dashboards during the run, and check the plan's connection limits first.
