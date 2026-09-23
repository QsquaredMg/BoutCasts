import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | BoutCasts",
  description: "How BoutCasts collects, uses, and protects your information.",
};

const SECTION_HEADING = "mb-2 mt-8 text-lg font-bold";
const BODY = "text-sm leading-relaxed";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Privacy Policy
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        Last updated {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
      </p>

      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        This Privacy Policy explains how BoutCasts (&quot;BoutCasts&quot;, &quot;we&quot;, &quot;us&quot;) collects,
        uses, and shares information when you use boutcasts.com and related services (the
        &quot;Service&quot;).
      </p>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Information we collect
      </h2>
      <ul className={`${BODY} list-disc space-y-1 pl-5`} style={{ color: "var(--text-dim)" }}>
        <li>Account information: email address, username, and password (stored securely, hashed, via our authentication provider).</li>
        <li>Content you submit: clips, links, titles, descriptions, comments, and other material you post to compete in or comment on bouts.</li>
        <li>Voting and engagement activity: which bouts you vote on, points earned, badges, and challenges you send or receive.</li>
        <li>Payment information: if you sponsor a category, payments are processed by Stripe. We do not store your card number — Stripe handles and stores that directly.</li>
        <li>Wallet activity: your BoutBucks balance and history.</li>
        <li>Usage data: pages visited, device/browser type, and similar technical information collected automatically.</li>
      </ul>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        How we use your information
      </h2>
      <ul className={`${BODY} list-disc space-y-1 pl-5`} style={{ color: "var(--text-dim)" }}>
        <li>To operate the Service — running bouts, tallying votes, tracking points/badges, and resolving challenges.</li>
        <li>To process payments and sponsorship billing.</li>
        <li>To moderate submitted content and enforce our Terms of Service.</li>
        <li>To communicate with you about your account, submissions, or support requests.</li>
        <li>To improve the Service and understand how it&apos;s used.</li>
      </ul>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Sharing your information
      </h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        We share information with service providers who help us run BoutCasts — currently Supabase
        (database, authentication, and storage) and Stripe (payment processing). We do not sell your
        personal information. We may disclose information if required by law, or to protect the
        rights, property, or safety of BoutCasts, our users, or others.
      </p>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Your choices
      </h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        You can update or delete your profile information from your account settings, or request
        account deletion by contacting us. Submitted content that has already appeared in a public
        bout may remain visible in historical results even after account deletion.
      </p>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Children&apos;s privacy
      </h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        BoutCasts is not directed to children under 13, and we do not knowingly collect personal
        information from children under 13.
      </p>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Changes to this policy
      </h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        We may update this Privacy Policy from time to time. We&apos;ll post the updated version here
        with a new &quot;last updated&quot; date.
      </p>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Contact us
      </h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        Questions about this policy? Email{" "}
        <a href="mailto:support@boutcasts.com" className="font-semibold underline" style={{ color: "var(--red)" }}>
          support@boutcasts.com
        </a>
        .
      </p>
    </div>
  );
}
