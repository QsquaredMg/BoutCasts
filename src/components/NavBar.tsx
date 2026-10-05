"use client";

import Link from "next/link";
import { BOUTBUCKS_ENABLED } from "@/lib/features";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import type { User } from "@supabase/supabase-js";

// Five main tabs: the same on desktop (top bar) and phones (bottom bar).
type Tab = { key: string; label: string; href: string; icon: (active: boolean) => React.ReactNode; match: (p: string) => boolean };

const DISCOVER_PREFIXES = [
  "/join",
  "/discover", "/matchups", "/explore", "/debates", "/leaderboard", "/c/", "/bracket", "/bout/",
  "/showcase/", "/competitions", "/search", "/boutcard", "/how-it-works",
];

function tabs(profileHref: string): Tab[] {
  return [
    { key: "home", label: "Home", href: "/", icon: (a) => <HomeIcon filled={a} />, match: (p) => p === "/" },
    {
      key: "discover",
      label: "Discover",
      href: "/discover",
      icon: (a) => <CompassIcon filled={a} />,
      match: (p) => DISCOVER_PREFIXES.some((x) => p === x || p.startsWith(x.endsWith("/") ? x : `${x}/`)),
    },
    {
      key: "create",
      label: "Create",
      href: "/create",
      icon: () => <PlusIcon />,
      match: (p) => ["/create", "/submit", "/live-vote/new", "/showcase/new", "/debates/new"].includes(p),
    },
    {
      key: "activity",
      label: "Activity",
      href: "/activity",
      icon: (a) => <BellIcon filled={a} />,
      match: (p) => p === "/activity" || p === "/challenges",
    },
    {
      key: "profile",
      label: "Profile",
      href: profileHref,
      icon: (a) => <UserIcon filled={a} />,
      match: (p) => p.startsWith("/profile/") || p === "/wallet",
    },
  ];
}

export default function NavBar() {
  const pathname = usePathname() ?? "/";
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [pendingChallenges, setPendingChallenges] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    async function loadProfile(u: User) {
      const [{ data: profile }, { count: challenges }, { count: unreadCount }] = await Promise.all([
        supabase.from("profiles").select("is_admin, wallet_balance, username").eq("id", u.id).maybeSingle(),
        supabase
          .from("challenges")
          .select("id", { count: "exact", head: true })
          .eq("opponent_id", u.id)
          .eq("status", "pending"),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("user_id", u.id)
          .eq("is_read", false),
      ]);
      setIsAdmin(!!profile?.is_admin);
      setWalletBalance(profile?.wallet_balance ?? 0);
      setUsername(profile?.username ?? null);
      setPendingChallenges(challenges ?? 0);
      setUnread(unreadCount ?? 0);
    }

    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user ?? null);
      if (data.user) await loadProfile(data.user);
      setLoading(false);
    });

    // Re-fetch on every auth change so signing in without a full reload still
    // fills in the username/admin flag (otherwise "Profile" points at /login).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUser(nextUser);
      if (nextUser) {
        loadProfile(nextUser);
      } else {
        setIsAdmin(false);
        setWalletBalance(null);
        setUsername(null);
        setPendingChallenges(0);
        setUnread(0);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.assign("/");
  }

  const profileHref = username ? `/profile/${encodeURIComponent(username)}` : user ? "/welcome" : "/login";
  const TABS = tabs(profileHref);
  const activityBadge = unread + pendingChallenges;
  // The organizer landing page has its own full-bleed hero with the logo.
  const hideTopBar = pathname === "/host";

  return (
    <>
      {!hideTopBar && (
        <nav data-site-chrome="" className="border-b" style={{ background: "var(--bg)", borderColor: "var(--border)" }}>
          <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <Link href="/" className="flex flex-shrink-0 items-center" aria-label="BoutCasts home">
              <Image
                src="/boutcasts-wordmark.png"
                alt="BoutCasts"
                width={608}
                height={160}
                priority
                className="h-8 w-auto sm:h-10"
              />
            </Link>

            {/* Desktop tabs */}
            <div
              className="hidden items-center gap-1 rounded-full p-1 md:flex"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              {TABS.filter((t) => t.key !== "create").map((t) => {
                const active = t.match(pathname);
                return (
                  <Link
                    key={t.key}
                    href={t.href}
                    className="relative rounded-full px-3.5 py-1.5 text-sm font-semibold"
                    style={{
                      fontFamily: "var(--font-display)",
                      background: active ? "var(--surface-2)" : "transparent",
                      color: active ? "var(--text)" : "var(--text-dim)",
                      boxShadow: active ? "inset 0 0 0 1px var(--border)" : "none",
                    }}
                  >
                    {t.label}
                    {t.key === "activity" && activityBadge > 0 && <Badge n={activityBadge} />}
                  </Link>
                );
              })}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="rounded-full px-3.5 py-1.5 text-sm font-semibold"
                  style={{
                    fontFamily: "var(--font-display)",
                    color: pathname.startsWith("/admin") ? "var(--text)" : "var(--text-dim)",
                  }}
                >
                  Admin
                </Link>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/search"
                className="flex h-9 w-9 items-center justify-center rounded-full border"
                style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
                aria-label="Search"
              >
                <SearchIcon />
              </Link>
              {user && (
                <span className="hidden md:inline-flex">
                  <NotificationBell userId={user.id} />
                </span>
              )}
              {BOUTBUCKS_ENABLED && user && walletBalance !== null && (
                <Link
                  href="/wallet"
                  className="hidden rounded-full px-3 py-1.5 text-xs font-bold md:inline-block"
                  style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
                >
                  💰 {walletBalance} BB
                </Link>
              )}
              <Link
                href="/host"
                className="hidden rounded-full px-4 py-1.5 text-sm font-bold text-white lg:inline-block"
                style={{ background: "#1b4fe4" }}
              >
                Host a vote
              </Link>
              <Link
                href="/create"
                className="hidden rounded-full px-4 py-1.5 text-sm font-bold text-white md:inline-block"
                style={{ background: "var(--red)" }}
              >
                + Create
              </Link>
              {!loading && !user && (
                <Link href="/login" className="bc-btn-solid rounded-full px-4 py-1.5 text-sm">
                  Log in
                </Link>
              )}
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-full border"
                style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
                aria-label={menuOpen ? "Close menu" : "More"}
                aria-expanded={menuOpen}
              >
                {menuOpen ? "✕" : "☰"}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div className="border-t" style={{ borderColor: "var(--border)", background: "var(--bg)" }}>
              <div className="mx-auto grid max-w-[1440px] gap-1 px-4 py-3 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
                <MenuLink href="/host" strong>
                  🎤 Host a vote — for schools, leagues &amp; events
                </MenuLink>
                <MenuLink href="/schools">🎓 For schools, colleges &amp; universities</MenuLink>
                <MenuLink href="/join">🔒 Have an event code? Join</MenuLink>
                <MenuLink href="/leaderboard">🏆 Leaderboard</MenuLink>
                <MenuLink href="/boutcard">🎟️ BoutCard</MenuLink>
                {user && (
                  <MenuLink href="/challenges">
                    🥊 Challenges{pendingChallenges > 0 ? ` (${pendingChallenges})` : ""}
                  </MenuLink>
                )}
                {user && <MenuLink href="/live-vote">🗳️ My Live Votes</MenuLink>}
                <MenuLink href="/how-it-works">❓ How it works</MenuLink>
                <MenuLink href="/sponsor">🤝 For brands &amp; sponsors</MenuLink>
                {isAdmin && <MenuLink href="/admin">🛠️ Admin</MenuLink>}
                {!loading &&
                  (user ? (
                    <button
                      onClick={handleSignOut}
                      className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold"
                      style={{ color: "var(--text-dim)" }}
                    >
                      ↩︎ Sign out
                    </button>
                  ) : (
                    <MenuLink href="/signup" strong>
                      ✨ Create a free account
                    </MenuLink>
                  ))}
              </div>
            </div>
          )}
        </nav>
      )}

      {/* Phone bottom tab bar */}
      <nav
        data-site-chrome=""
        data-bottom-tabs=""
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
        style={{
          background: "color-mix(in srgb, var(--bg) 94%, transparent)",
          borderColor: "var(--border)",
          backdropFilter: "blur(10px)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <div className="mx-auto grid max-w-md grid-cols-5">
          {TABS.map((t) => {
            const active = t.match(pathname);
            if (t.key === "create") {
              return (
                <Link key={t.key} href={t.href} className="flex flex-col items-center justify-center py-1.5" aria-label="Create">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                    style={{ background: "var(--red)", boxShadow: "0 4px 12px rgba(27,79,228,0.35)" }}
                  >
                    {t.icon(active)}
                  </span>
                </Link>
              );
            }
            return (
              <Link
                key={t.key}
                href={t.href}
                className="relative flex flex-col items-center justify-center gap-0.5 py-2 text-[10.5px] font-bold"
                style={{ color: active ? "var(--text)" : "var(--text-faint)" }}
                aria-current={active ? "page" : undefined}
              >
                <span className="relative">
                  {t.icon(active)}
                  {t.key === "activity" && activityBadge > 0 && <Badge n={activityBadge} />}
                </span>
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

function MenuLink({ href, children, strong = false }: { href: string; children: React.ReactNode; strong?: boolean }) {
  return (
    <Link
      href={href}
      className="rounded-lg px-3 py-2.5 text-sm font-semibold hover:bg-[var(--surface-2)]"
      style={{ color: strong ? "var(--red)" : "var(--text-dim)" }}
    >
      {children}
    </Link>
  );
}

function Badge({ n }: { n: number }) {
  return (
    <span
      className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
      style={{ background: "var(--live, #e11d48)" }}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

const svg = (filled: boolean, path: React.ReactNode) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? 0 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {path}
  </svg>
);

function HomeIcon({ filled }: { filled: boolean }) {
  return filled
    ? svg(true, <path d="M11.3 2.6a1 1 0 0 1 1.4 0l8.6 8.2c.6.6.2 1.7-.7 1.7H19V20a1 1 0 0 1-1 1h-4v-6h-4v6H6a1 1 0 0 1-1-1v-7.5H3.4c-.9 0-1.3-1.1-.7-1.7z" />)
    : svg(false, <path d="M3 11.5 12 3l9 8.5M5 10v10h5v-6h4v6h5V10" />);
}
function CompassIcon({ filled }: { filled: boolean }) {
  return svg(
    false,
    <>
      <circle cx="12" cy="12" r="9" strokeWidth={filled ? 2.4 : 2} />
      <path d="m15.5 8.5-2 5-5 2 2-5z" fill={filled ? "currentColor" : "none"} />
    </>
  );
}
function PlusIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function BellIcon({ filled }: { filled: boolean }) {
  return svg(filled, <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10.3 20a2 2 0 0 0 3.4 0" />);
}
function UserIcon({ filled }: { filled: boolean }) {
  return svg(
    filled,
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7" />
    </>
  );
}
function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}
