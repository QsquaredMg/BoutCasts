"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { friendlyAuthError } from "@/lib/authMessages";

// "Continue with Google" using Google's own sign-in button. Google signs the person in on this site and
// hands us an ID token, which Supabase verifies. That keeps the Google screen saying boutcasts.com instead
// of the Supabase project address (which is what the redirect-based sign-in shows).

type CredentialResponse = { credential: string };
type GoogleId = {
  initialize: (cfg: {
    client_id: string;
    callback: (r: CredentialResponse) => void;
    nonce?: string;
    ux_mode?: "popup" | "redirect";
    auto_select?: boolean;
    use_fedcm_for_button?: boolean;
  }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
};
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";
let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => {
      scriptPromise = null;
      reject(new Error("Google sign-in could not load."));
    };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function GoogleIdButton({
  clientId,
  onSignedIn,
  onError,
  onUnavailable,
}: {
  clientId: string;
  onSignedIn: (user: NonNullable<Awaited<ReturnType<ReturnType<typeof createClient>["auth"]["getUser"]>>["data"]["user"]>) => void;
  onError: (message: string) => void;
  /** The Google script was blocked or failed: let the caller fall back to the redirect sign-in. */
  onUnavailable: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const cb = useRef({ onSignedIn, onError, onUnavailable });
  useEffect(() => {
    cb.current = { onSignedIn, onError, onUnavailable };
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await loadScript();
        if (!alive || !host.current || !window.google) return;
        const raw = crypto.randomUUID() + crypto.randomUUID();
        const hashed = await sha256Hex(raw);
        window.google.accounts.id.initialize({
          client_id: clientId,
          nonce: hashed,
          ux_mode: "popup",
          auto_select: false,
          use_fedcm_for_button: true,
          callback: async (resp) => {
            const supabase = createClient();
            const { data, error } = await supabase.auth.signInWithIdToken({ provider: "google", token: resp.credential, nonce: raw });
            if (error || !data.user) {
              cb.current.onError(friendlyAuthError(error?.message ?? "Google sign-in failed. Please try again."));
              return;
            }
            cb.current.onSignedIn(data.user);
          },
        });
        const width = Math.min(400, Math.max(200, Math.round(host.current.getBoundingClientRect().width || 320)));
        window.google.accounts.id.renderButton(host.current, { type: "standard", theme: "outline", size: "large", shape: "pill", text: "continue_with", logo_alignment: "center", width });
      } catch {
        if (alive) cb.current.onUnavailable();
      }
    })();
    return () => {
      alive = false;
    };
  }, [clientId]);

  return <div ref={host} className="flex min-h-[44px] w-full justify-center" aria-label="Continue with Google" />;
}
