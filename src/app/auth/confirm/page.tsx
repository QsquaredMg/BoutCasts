import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safeNext";

export const metadata: Metadata = { title: "Confirm", robots: { index: false } };

// Landing page for the links in BoutCasts auth emails. The email links here
// (not straight to the one-time token) so that email security scanners, which
// open every link in a message, can't use up the token before the person
// clicks. The button below is what actually verifies.
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string; next?: string }>;
}) {
  const { token_hash, type, next } = await searchParams;
  if (!token_hash || !type) redirect("/login?notice=link_expired");

  const isRecovery = type === "recovery";
  const qs = new URLSearchParams({ token_hash, type, next: safeNext(next) });

  return (
    <div className="mx-auto max-w-lg px-5 py-10">
      <div className="relative overflow-hidden rounded-3xl p-7 sm:p-9" style={{ background: "#0a0e1a", color: "#fff" }}>
        <div
          aria-hidden
          className="pointer-events-none absolute"
          style={{ right: -96, top: -80, width: 150, height: 560, background: "#1b4fe4", transform: "rotate(14deg)" }}
        />
        <div className="relative max-w-[72%]">
          <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.12em]" style={{ color: "#9fb8ff" }}>
            {isRecovery ? "Password reset" : "Almost there"}
          </p>
          <h1 className="text-3xl leading-[0.95] sm:text-4xl" style={{ fontWeight: 900, textTransform: "uppercase", fontStretch: "112%" }}>
            {isRecovery ? "Reset your password" : "Confirm your email"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "#c9d0e0" }}>
            {isRecovery
              ? "Tap below to continue and choose a new password."
              : "Tap below to confirm your email and finish creating your BoutCasts account."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Link
              href={`/auth/callback?${qs.toString()}`}
              prefetch={false}
              className="inline-flex min-h-[46px] items-center rounded-full px-5 text-sm font-bold"
              style={{ background: "#1b4fe4", color: "#fff" }}
            >
              {isRecovery ? "Continue" : "Confirm my email"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
