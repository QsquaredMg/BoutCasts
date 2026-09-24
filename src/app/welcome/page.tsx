import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

// First screen a signed-out user sees after the app launch splash (see
// SplashScreen). Full-screen, covering the site nav, and it funnels to the two
// doors: create a Live Vote or vote on a live bout — with log in / sign up.
export const metadata: Metadata = {
  title: "Welcome",
  robots: { index: false },
};

export default function WelcomePage() {
  return (
    <div className="lp fixed inset-0 z-[90] flex flex-col overflow-y-auto" style={{ background: "var(--lp-ink)" }}>
      <div aria-hidden className="splash-slash" style={{ top: -200, height: 900 }} />

      <div className="relative mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-5 px-6 pb-7 pt-[max(56px,env(safe-area-inset-top))] text-white">
        <Image src="/boutcasts-logo-reverse.png" alt="BoutCasts" width={618} height={170} priority className="h-auto w-[180px]" />
        <div className="min-h-8 flex-1" />
        <div className="lp-eyebrow flex items-center gap-2" style={{ color: "#9fb8ff" }}>
          <span className="lp-live-dot" aria-hidden /> Welcome to BoutCasts
        </div>
        <h1 className="lp-display text-[56px] sm:text-[64px]" style={{ lineHeight: 0.92 }}>
          Let the
          <br />
          crowd <span style={{ color: "var(--lp-blue-light)" }}>decide.</span>
        </h1>
        <p className="max-w-[320px] text-[16px] leading-relaxed" style={{ color: "var(--lp-body-dark)" }}>
          Vote on live battles, or run your own election, poll or event vote — results in real time.
        </p>
        <div className="flex flex-wrap gap-2">
          {["Class elections", "Event polls", "Battles & brackets"].map((chip) => (
            <span
              key={chip}
              className="rounded-full border px-3 py-1.5 text-[13px] font-bold"
              style={{ background: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.22)" }}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>

      <div
        className="relative mx-auto flex w-full max-w-[520px] shrink-0 flex-col gap-3 rounded-t-[28px] px-6 pt-7 sm:mb-8 sm:rounded-[28px]"
        style={{ background: "#fff", paddingBottom: "max(36px, env(safe-area-inset-bottom))" }}
      >
        <Link href="/live-vote/new" className="lp-btn py-[17px] text-[17px]" style={{ background: "var(--lp-blue)", color: "#fff" }}>
          Start a Live Vote
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </Link>
        <Link href="/matchups" className="lp-btn py-[17px] text-[17px]" style={{ background: "#f1f3f8", color: "var(--lp-ink)" }}>
          Vote on live bouts
        </Link>
        <div className="flex items-center justify-center gap-1.5 pt-1.5 text-[15px]" style={{ color: "var(--lp-muted)" }}>
          <span>Have an account?</span>
          <Link href="/login" className="px-1 py-2 font-bold" style={{ color: "var(--lp-blue)" }}>
            Log in
          </Link>
          <span aria-hidden style={{ color: "#c3c8d4" }}>
            ·
          </span>
          <Link href="/signup" className="px-1 py-2 font-bold" style={{ color: "var(--lp-blue)" }}>
            Sign up
          </Link>
        </div>
        <Link href="/" className="text-center text-[14px] font-semibold underline" style={{ color: "var(--lp-muted)" }}>
          Just looking? Explore BoutCasts
        </Link>
      </div>
    </div>
  );
}
