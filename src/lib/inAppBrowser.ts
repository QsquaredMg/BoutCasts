"use client";

import { useSyncExternalStore } from "react";

// Facebook, Messenger and Instagram open links in their own built-in browser. People can vote there as
// guests, but Google refuses to sign anyone in from inside it, so we point them to the email-code option.
export function isSocialInAppBrowser(ua: string): boolean {
  return /FBAN|FBAV|FB_IAB|FBIOS|Messenger|Instagram/i.test(ua);
}

const subscribe = () => () => {};
/** True inside Facebook / Messenger / Instagram's built-in browser. False on the server and elsewhere. */
export function useSocialInAppBrowser(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => isSocialInAppBrowser(navigator.userAgent),
    () => false,
  );
}
