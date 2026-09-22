import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | BoutCasts",
  description: "The terms that govern your use of BoutCasts.",
};

const SECTION_HEADING = "mb-2 mt-8 text-lg font-bold";
const BODY = "text-sm leading-relaxed";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Terms of Service
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Last updated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        These Terms of Service (&quot;Terms&quot;) govern your access to and use of boutcasts.com and
        related services (the &quot;Service&quot;), operated by BoutCasts (&quot;we&quot;, &quot;us&quot;). By
        creating an account or using the Service, you agree to these Terms.
      </p>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Accounts
      </h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        You must provide accurate information when creating an account and are responsible for
        activity that happens under it. You must be at least 13 years old to use BoutCasts.
      </p>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Submissions &amp; content
      </h2>
      <ul className={`${BODY} list-disc space-y-1 pl-5`} style={{ color: "var(--text-dim)" }}>
        <li>You retain ownership of content you submit, but grant BoutCasts a worldwide, royalty-free license to host, display, and distribute it as part of operating the Service (including bout pages, recaps, and promotional material).</li>
        <li>You must have the rights to submit any clip, link, or recording you post, and it must not infringe anyone else&apos;s copyright, trademark, or other rights.</li>
        <li>Submissions are subject to review and can be rejected or removed at our discretion — including for violating these Terms, being fraudulent, or receiving a valid report.</li>
      </ul>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Voting, points &amp; badges
      </h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        Votes are limited to one per account per bout and are meant to reflect genuine crowd
        judgment. We may void votes, points, or results we determine were obtained through
        manipulation (e.g. bots, vote-buying, or coordinated fraud).
      </p>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Payments, prizes &amp; BoutBucks
      </h2>
      <ul className={`${BODY} list-disc space-y-1 pl-5`} style={{ color: "var(--text-dim)" }}>
        <li>Paid entries, BoutCasts Pro subscriptions, and sponsorships are billed through Stripe. Subscriptions renew automatically until cancelled.</li>
        <li>BoutBucks are an in-platform balance with no cash value except through an approved cash-redemption request. We may set minimums, fees, or review periods on redemptions.</li>
        <li>Cash prizes and redemptions are subject to review and can be delayed or denied if we suspect fraud or a Terms violation.</li>
        <li>All sales and completed sponsorship payments are final except where required otherwise by law.</li>
      </ul>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Prohibited conduct
      </h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        You may not use the Service to harass or impersonate others, upload content you don&apos;t
        have the rights to, manipulate votes or payouts, or attempt to disrupt or reverse-engineer
        the Service.
      </p>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Disclaimers &amp; limitation of liability
      </h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        The Service is provided &quot;as is&quot; without warranties of any kind. To the fullest extent
        permitted by law, BoutCasts is not liable for indirect, incidental, or consequential damages
        arising from your use of the Service.
      </p>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Changes to these Terms
      </h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        We may update these Terms from time to time. Continued use of the Service after a change
        means you accept the updated Terms.
      </p>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Contact us
      </h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        Questions about these Terms? Email{" "}
        <a href="mailto:support@boutcasts.com" className="font-semibold underline" style={{ color: "var(--red)" }}>
          support@boutcasts.com
        </a>
        .
      </p>
    </div>
  );
}
