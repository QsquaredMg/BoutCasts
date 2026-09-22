import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="border-t"
      style={{ background: "var(--bg)", borderColor: "var(--border)" }}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-6 text-sm">
        <div style={{ color: "var(--text-faint)" }}>
          © {year} BoutCasts. All rights reserved.
        </div>
        <nav className="flex flex-wrap items-center gap-4" style={{ color: "var(--text-dim)" }}>
          <Link href="/how-it-works" className="hover:underline">
            How it works
          </Link>
          <Link href="/sponsor" className="hover:underline">
            For Brands
          </Link>
          <Link href="/privacy" className="hover:underline">
            Privacy Policy
          </Link>
          <Link href="/terms" className="hover:underline">
            Terms of Service
          </Link>
          <a href="mailto:support@boutcasts.com" className="hover:underline">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
