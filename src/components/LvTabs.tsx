"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/live-vote", label: "My votes", match: (p: string) => p === "/live-vote" || (p.startsWith("/live-vote/") && !p.startsWith("/live-vote/new")) },
  { href: "/live-vote/new", label: "Create a vote", match: (p: string) => p.startsWith("/live-vote/new") },
  { href: "/schools", label: "For schools", match: () => false },
  { href: "/org", label: "School license", match: () => false },
];

export default function LvTabs() {
  const path = usePathname() ?? "";
  return (
    <nav className="lv-tabs" aria-label="Live Vote">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className="lv-tab" aria-current={t.match(path) ? "page" : undefined}>{t.label}</Link>
      ))}
    </nav>
  );
}
