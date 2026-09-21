"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

export default function NavBar() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user ?? null);
      if (data.user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("is_admin, wallet_balance")
          .eq("id", data.user.id)
          .maybeSingle();
        setIsAdmin(!!profile?.is_admin);
        setWalletBalance(profile?.wallet_balance ?? 0);
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
    <nav className="border-b border-neutral-800 bg-neutral-950 text-white">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          BoutCasts
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/" className="hover:text-red-400">
            Bouts
          </Link>
          <Link href="/submit" className="hover:text-red-400">
            Submit
          </Link>
          <Link href="/leaderboard" className="hover:text-red-400">
            Leaderboard
          </Link>
          {isAdmin && (
            <Link href="/admin/moderation" className="hover:text-red-400">
              Moderation
            </Link>
          )}
          {loading ? null : user ? (
            <div className="flex items-center gap-3">
              {walletBalance !== null && (
                <span
                  title="BoutBucks wallet balance"
                  className="rounded-full bg-neutral-800 px-2.5 py-1 text-xs font-semibold text-amber-400"
                >
                  💰 {walletBalance} BB
                </span>
              )}
              <span className="text-neutral-400">{user.email}</span>
              <button
                onClick={handleSignOut}
                className="rounded bg-neutral-800 px-3 py-1 hover:bg-neutral-700"
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="rounded bg-red-600 px-3 py-1 font-medium hover:bg-red-500"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
