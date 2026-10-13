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

const VOTE_PREFIXES = [
  "/join", "/vote", "/discover", "/debates", "/leaderboard", "/c/", "/bracket", "/bout/",
  "/showcase/", "/competitions", "/search", "/boutcard", "/how-it-works", "/trivia/",
];

const PREDICTION_PREFIXES = ["/predictions"];
const HOST_PREFIXES = ["/host", "/schools", "/live-vote", "/trivia/play", "/trivia/packs", "/sponsor"];
const ME_PREFIXES = ["/profile/", "/wallet", "/activity", "/challenges", "/welcome"];

const startsWithAny = (p: string, list: string[]) => list.some((x) => p === x || p.startsWith(x.endsWith("/") ? x : `${x}/`));

// Four places to be, plus one button to make something. Everything else lives in the menu.
function tabs(profileHref: string): Tab[] {
  return [
    {
      key: "vote",
      label: "Vote",
      href: "/discover",
      icon: (a) => <CompassIcon filled={a} />,
      match: (p) => !startsWithAny(p, HOST_PREFIXES) && !startsWithAny(p, PREDICTION_PREFIXES) && startsWithAny(p, VOTE_PREFIXES),
    },
    {
      key: "predictions",
      label: "Predict",
      href: "/predictions",
      icon: (a) => <TargetIcon filled={a} />,
      match: (p) => startsWithAny(p, PREDICTION_PREFIXES),
    },
    {
      key: "create",
      label: "Create",
      href: "/create",
      icon: () => <PlusIcon />,
      match: (p) => ["/create", "/submit", "/live-vote/new", "/showcase/new", "/debates/new"].includes(p),
    },
    {
      key: "host",
      label: "Host",
      href: "/host",
      icon: (a) => <MicIcon filled={a} />,
      match: (p) => startsWithAny(p, HOST_PREFIXES),
    },
    {
      key: "me",
      label: "Me",
      href: profileHref,
      icon: (a) => <UserIcon filled={a} />,
      match: (p) => startsWithAny(p, ME_PREFIXES),
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
                    {t.key === "me" && activityBadge > 0 && <Badge n={activityBadge} />}
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
                href="/join"
                className="rounded-full border px-3.5 py-1.5 text-sm font-bold"
                style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--surface)" }}
              >
                Join
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
              <div className="mx-auto grid max-w-[1440px] gap-x-6 gap-y-3 px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-4">
                <MenuGroup title="Play">
                  <MenuLink href="/join" strong>🔒 Join with a code or link</MenuLink>
                  <MenuLink href="/predictions">🎯 Bout Predictions</MenuLink>
                  <MenuLink href="/trivia">❓ Live Trivia</MenuLink>
                  <MenuLink href="/paid-bouts">💵 Paid Bouts</MenuLink>
                  <MenuLink href="/leaderboard">🏆 Leaderboard</MenuLink>
                  <MenuLink href="/boutcard">🎟️ BoutCard</MenuLink>
                </MenuGroup>
                <MenuGroup title="Host">
                  <MenuLink href="/host" strong>🎤 Host a vote or trivia night</MenuLink>
                  <MenuLink href="/schools">🎓 Schools, colleges &amp; universities</MenuLink>
                  <MenuLink href="/sponsor">🤝 Brands &amp; sponsors</MenuLink>
                  {user && <MenuLink href="/live-vote">🗳️ My Live Votes</MenuLink>}
                </MenuGroup>
                <MenuGroup title="Me">
                  {user ? (
                    <>
                      <MenuLink href={profileHref}>👤 My profile</MenuLink>
                      <MenuLink href="/settings">⚙️ Settings &amp; safety</MenuLink>
                      <MenuLink href="/activity">🔔 Activity{unread > 0 ? ` (${unread})` : ""}</MenuLink>
                      <MenuLink href="/challenges">🥊 Challenges{pendingChallenges > 0 ? ` (${pendingChallenges})` : ""}</MenuLink>
                      {BOUTBUCKS_ENABLED && <MenuLink href="/wallet">💰 Wallet{walletBalance !== null ? ` (${walletBalance} BB)` : ""}</MenuLink>}
                    </>
                  ) : (
                    !loading && (
                      <>
                        <MenuLink href="/signup" strong>✨ Create a free account</MenuLink>
                        <MenuLink href="/login">Log in</MenuLink>
                      </>
                    )
                  )}
                </MenuGroup>
                <MenuGroup title="More">
                  <MenuLink href="/how-it-works">❓ How it works</MenuLink>
                  {isAdmin && <MenuLink href="/admin">🛠️ Admin</MenuLink>}
                  {!loading && user && (
                    <button
                      onClick={handleSignOut}
                      className="rounded-lg px-3 py-2.5 text-left text-sm font-semibold"
                      style={{ color: "var(--text-dim)" }}
                    >
                      ↩︎ Sign out
                    </button>
                  )}
                </MenuGroup>
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
                  {t.key === "me" && activityBadge > 0 && <Badge n={activityBadge} />}
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

function MenuGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="px-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
        {title}
      </div>
      {children}
    </div>
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

function CompassIcon({ filled }: { filled: boolean }) {
  return svg(
    false,
    <>
      <circle cx="12" cy="12" r="9" strokeWidth={filled ? 2.4 : 2} />
      <path d="m15.5 8.5-2 5-5 2 2-5z" fill={filled ? "currentColor" : "none"} />
    </>
  );
}
function TargetIcon({ filled }: { filled: boolean }) {
  return svg(
    false,
    <>
      <circle cx="12" cy="12" r="9" strokeWidth={filled ? 2.4 : 2} />
      <circle cx="12" cy="12" r="4.5" strokeWidth={filled ? 2.4 : 2} />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
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
function MicIcon({ filled }: { filled: boolean }) {
  return svg(
    false,
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" fill={filled ? "currentColor" : "none"} />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  );
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
