"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import NotificationBell from "@/components/NotificationBell";
import type { User } from "@supabase/supabase-js";

const NAV_LINKS = [
  { href: "/", label: "BoutCard" },
  { href: "/submit", label: "Submit" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/how-it-works", label: "How it works" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [pendingChallenges, setPendingChallenges] = useState(0);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user ?? null);
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin, wallet_balance, username")
          .eq("id", data.user.id)
          .maybeSingle();
        setIsAdmin(!!profile?.is_admin);
        setWalletBalance(profile?.wallet_balance ?? 0);
        setUsername(profile?.username ?? null);

        const { count } = await supabase
          .from("challenges")
          .select("id", { count: "exact", head: true })
          .eq("opponent_id", data.user.id)
          .eq("status", "pending");
        setPendingChallenges(count ?? 0);
      }
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <nav
      className="border-b"
      style={{ background: "var(--bg)", borderColor: "var(--border)" }}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-5 py-4">
        <Link
          href="/"
          className="text-xl font-bold tracking-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--text)" }}
        >
          Bout<span style={{ color: "var(--red)" }}>Casts</span>
        </Link>

        <div
          className="flex gap-1 rounded-full p-1"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          {NAV_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-full px-4 py-1.5 text-sm font-semibold tracking-wide"
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
          {isAdmin && (
            <>
              <Link
                href="/admin/moderation"
                className="rounded-full px-4 py-1.5 text-sm font-semibold tracking-wide"
                style={{
                  fontFamily: "var(--font-display)",
                  color: pathname === "/admin/moderation" ? "var(--text)" : "var(--text-dim)",
                }}
              >
                Moderation
              </Link>
              <Link
                href="/admin/sponsors"
                className="rounded-full px-4 py-1.5 text-sm font-semibold tracking-wide"
                style={{
                  fontFamily: "var(--font-display)",
                  color: pathname === "/admin/sponsors" ? "var(--text)" : "var(--text-dim)",
                }}
              >
                Sponsors
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/search"
            className="rounded-full border px-3 py-1.5 text-xs font-bold"
            style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            title="Search"
          >
            🔍
          </Link>
          {user && <NotificationBell userId={user.id} />}
          {user && (
            <Link
              href="/challenges"
              className="relative rounded-full border px-3 py-1.5 text-xs font-bold"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
              title="Challenges"
            >
              🥊
              {pendingChallenges > 0 && (
                <span
                  className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                  style={{ background: "var(--red)" }}
                >
                  {pendingChallenges}
                </span>
              )}
            </Link>
          )}
          {loading ? null : user ? (
            <>
              {walletBalance !== null && (
                <Link
                  href="/wallet"
                  title="BoutBucks wallet balance"
                  className="rounded-full px-3 py-1.5 text-xs font-bold"
                  style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
                >
                  💰 {walletBalance} BB
                </Link>
              )}
              {username && (
                <Link
                  href={`/profile/${username}`}
                  className="hidden text-sm font-semibold sm:inline hover:underline"
                  style={{ color: "var(--text-dim)" }}
                >
                  {username}
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="rounded-full border px-4 py-1.5 text-sm font-semibold"
                style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="bc-btn-solid rounded-full px-4 py-1.5 text-sm"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
