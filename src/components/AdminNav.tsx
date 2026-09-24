"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ADMIN_LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/moderation", label: "Moderation" },
  { href: "/admin/sponsors", label: "Sponsors" },
  { href: "/admin/bouts", label: "Bouts" },
  { href: "/admin/ads", label: "Ads" },
  { href: "/admin/live-vote", label: "Live Vote" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/users", label: "Users" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex flex-wrap items-center gap-1 border-b pb-3" style={{ borderColor: "var(--border)" }}>
      {ADMIN_LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full px-3 py-1.5 text-sm font-semibold tracking-wide"
            style={{
              fontFamily: "var(--font-display)",
              background: active ? "var(--surface-2)" : "transparent",
              color: active ? "var(--text)" : "var(--text-dim)",
              boxShadow: active ? "inset 0 0 0 1px var(--border)" : "none",
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
