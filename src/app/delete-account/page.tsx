import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Delete your account",
  description: "How to permanently delete your BoutCasts account and what happens to your data.",
};

const H2 = "mb-2 mt-8 text-lg font-bold";
const BODY = "text-sm leading-relaxed";

export default function DeleteAccountPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Delete your BoutCasts account
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        You can delete your account yourself at any time.
      </p>

      <h2 className={H2} style={{ fontFamily: "var(--font-display)" }}>How to delete</h2>
      <ol className={`${BODY} list-decimal pl-5`} style={{ color: "var(--text-dim)" }}>
        <li>Sign in at boutcasts.com.</li>
        <li>Open the menu and choose <strong>Settings &amp; safety</strong>, or go straight to{" "}
          <Link href="/settings" className="underline">boutcasts.com/settings</Link>.</li>
        <li>Under <strong>Delete my account</strong>, type DELETE and confirm.</li>
      </ol>
      <p className={`${BODY} mt-3`} style={{ color: "var(--text-dim)" }}>
        Can&apos;t sign in? Email{" "}
        <a href="mailto:support@boutcasts.com?subject=Delete%20my%20account" className="underline">support@boutcasts.com</a>{" "}
        from the address on the account and we&apos;ll delete it for you.
      </p>

      <h2 className={H2} style={{ fontFamily: "var(--font-display)" }}>What gets deleted</h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        Your profile, username, avatar, birthday and demographic answers, votes, predictions, comments, submissions,
        follows, badges, points, wallet balance, notifications and push subscriptions. Paid subscriptions are canceled
        first so you are not billed again.
      </p>

      <h2 className={H2} style={{ fontFamily: "var(--font-display)" }}>What we keep</h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        Records of payments, entry fees and payouts are kept for tax and accounting purposes, with your name and
        account removed from them. Aggregate totals (for example how many votes a bout received) stay the same.
      </p>

      <h2 className={H2} style={{ fontFamily: "var(--font-display)" }}>Before you delete</h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        If you run a paid bout that hasn&apos;t settled, are waiting on a payout, or own an organization with an
        active license, settle those first. We&apos;ll tell you exactly what is outstanding if you try.
      </p>
    </div>
  );
}
