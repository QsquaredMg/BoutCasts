"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Lets a signed-in person turn phone/desktop notifications on for this
// device. On iPhone/iPad, web notifications only work once BoutCasts has been
// added to the Home Screen and opened from there, so we explain that instead.

type State = "loading" | "unsupported" | "ios-install" | "denied" | "off" | "on" | "working";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

export default function PushOptIn({ compact = false }: { compact?: boolean }) {
  const supabase = createClient();
  const [state, setState] = useState<State>("loading");
  const [error, setError] = useState<string | null>(null);
  const vapid = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    async function check() {
      const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
      if (!supported || !vapid) {
        setState(isIOS() && !isStandalone() ? "ios-install" : "unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      setState(sub && Notification.permission === "granted" ? "on" : "off");
    }
    check().catch(() => setState("unsupported"));
  }, [vapid]);

  async function turnOn() {
    setError(null);
    setState("working");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(vapid!) }));
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const { error: saveErr } = await supabase.rpc("save_push_subscription", {
        p_endpoint: json.endpoint,
        p_p256dh: json.keys.p256dh,
        p_auth: json.keys.auth,
        p_user_agent: navigator.userAgent,
      });
      if (saveErr) throw new Error(saveErr.message);
      setState("on");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't turn on notifications.");
      setState("off");
    }
  }

  async function turnOff() {
    setError(null);
    setState("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = reg ? await reg.pushManager.getSubscription() : null;
      if (sub) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setState("on");
    }
  }

  if (state === "loading" || state === "unsupported") return null;

  const box = compact ? "rounded-xl border p-3" : "mb-4 rounded-xl border p-4";
  const boxStyle = { borderColor: "var(--border)", background: "var(--surface)" };

  return (
    <div className={box} style={boxStyle}>
      <p className="text-sm font-bold">🔔 Notifications</p>
      {state === "ios-install" ? (
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
          To get alerts on iPhone: tap the <b>Share</b> button, choose <b>Add to Home Screen</b>, then open
          BoutCasts from your Home Screen and turn notifications on here.
        </p>
      ) : state === "denied" ? (
        <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
          Notifications are blocked for BoutCasts on this device. Turn them back on in your browser or phone
          settings, then reload this page.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-dim)" }}>
            {state === "on"
              ? "On for this device. We'll let you know when big bouts and live votes are happening."
              : "Get a heads-up on this device when big bouts and live votes go live."}
          </p>
          <button
            type="button"
            onClick={state === "on" ? turnOff : turnOn}
            disabled={state === "working"}
            className={
              state === "on"
                ? "mt-2.5 rounded-full border px-4 py-2 text-xs font-bold disabled:opacity-60"
                : "bc-btn-solid mt-2.5 rounded-full px-4 py-2 text-xs font-bold disabled:opacity-60"
            }
            style={state === "on" ? { borderColor: "var(--border)" } : undefined}
          >
            {state === "working" ? "One moment…" : state === "on" ? "Turn off" : "Turn on notifications"}
          </button>
        </>
      )}
      {error && (
        <p className="mt-2 text-xs" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
