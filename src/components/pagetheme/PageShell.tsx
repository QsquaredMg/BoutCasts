"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cond } from "@/app/predictions/font";
import "./pg-theme.css";

export type PageTheme = "main" | "comp" | "show" | "paid" | "spons" | "deb";

export type ShellTab = {
  href: string;
  label: string;
  /** Pathname prefixes (or exact paths ending in $) that mark this tab as current. */
  match?: string[];
};

// Wraps a product's working pages in the same look as its funnel: a colored header band
// with the product name and tabs. The funnel page itself (/…/play) has its own full design,
// so it is passed through untouched.
export default function PageShell({
  theme,
  name,
  accent,
  tagline,
  tabs,
  wide,
  bandWidth,
  children,
}: {
  theme: PageTheme;
  name: string;
  accent: string;
  tagline: string;
  tabs: ShellTab[];
  wide?: boolean;
  /** CSS max-width for the header band, to line up with a wider page below. */
  bandWidth?: string;
  children: React.ReactNode;
}) {
  const path = usePathname() ?? "";
  if (path.endsWith("/play")) return <>{children}</>;

  const isCurrent = (t: ShellTab) =>
    (t.match ?? [t.href]).some((m) => (m.endsWith("$") ? path === m.slice(0, -1) : path === m || path.startsWith(m + "/")));

  return (
    <div className={`pg pg-${theme} ${cond.variable}`}>
      <header className="pg-band">
        <div className={`pg-band-in${wide ? " wide" : ""}`} style={bandWidth ? { maxWidth: bandWidth } : undefined}>
          <div className="pg-brand">
            <span className="pg-mark">
              {name} <i>{accent}</i>
            </span>
            <span className="pg-tag">{tagline}</span>
          </div>
          <nav className="pg-tabs" aria-label={`${name} ${accent}`}>
            {tabs.map((t) => (
              <Link key={t.href + t.label} href={t.href} className="pg-tab" aria-current={isCurrent(t) ? "page" : undefined}>
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <div className="pg-rule" />
      {children}
    </div>
  );
}
