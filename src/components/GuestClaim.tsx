"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { GUEST_TOKEN_KEY, clearGuestIdentity } from "@/lib/guestPass";

// When someone who voted as a guest signs in or signs up, move their guest votes onto the account.
export default function GuestClaim() {
  useEffect(() => {
    const sb = createClient();
    let running = false;
    async function claim() {
      if (running) return;
      let tok: string | null = null;
      try { tok = localStorage.getItem(GUEST_TOKEN_KEY); } catch {}
      if (!tok) return;
      running = true;
      const { error } = await sb.rpc("claim_guest_activity", { p_token: tok });
      running = false;
      if (!error) clearGuestIdentity();
    }
    sb.auth.getUser().then(({ data }) => { if (data.user) claim(); });
    const { data: sub } = sb.auth.onAuthStateChange((ev, session) => {
      if (session?.user && (ev === "SIGNED_IN" || ev === "INITIAL_SESSION")) setTimeout(claim, 0);
    });
    return () => sub.subscription.unsubscribe();
  }, []);
  return null;
}
