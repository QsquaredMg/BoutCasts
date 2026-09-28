// Plain-English versions of Supabase Auth errors and of the "notice" codes
// our auth routes attach to /login, so people see what to do next instead of
// raw messages like "Email not confirmed" or "otp_expired".

export type AuthProblem = "unconfirmed" | "bad_credentials" | "rate_limited" | "exists" | "other";

export function classifyAuthError(message: string | undefined | null): AuthProblem {
  const m = (message ?? "").toLowerCase();
  if (m.includes("not confirmed")) return "unconfirmed";
  if (m.includes("invalid login credentials") || m.includes("invalid credentials")) return "bad_credentials";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes")) return "rate_limited";
  if (m.includes("already registered") || m.includes("already exists")) return "exists";
  return "other";
}

export function friendlyAuthError(message: string | undefined | null): string {
  switch (classifyAuthError(message)) {
    case "unconfirmed":
      return "You need to confirm your email before signing in. Check your inbox (and spam) for the link from BoutCasts, or send a new one below.";
    case "bad_credentials":
      return "That email and password don't match. Check for typos, or reset your password below.";
    case "rate_limited":
      return "Too many emails were sent recently. Please wait a few minutes and try again.";
    case "exists":
      return "An account with this email already exists. Sign in instead, or reset your password.";
    default:
      return message || "Something went wrong. Please try again.";
  }
}

// Notices shown at the top of /login after an email link.
export const LOGIN_NOTICES: Record<string, { tone: "ok" | "warn"; text: string }> = {
  confirmed: { tone: "ok", text: "Your email is confirmed. Sign in to get started." },
  verify_other_device: {
    tone: "ok",
    text: "If you just clicked your confirmation link, your email is confirmed — sign in below. (Links opened in a different browser or app can't sign you in automatically.)",
  },
  link_expired: {
    tone: "warn",
    text: "That email link has expired or was already used. If you already confirmed, just sign in. Otherwise enter your email and password below and we'll offer to send a fresh link.",
  },
  password_updated: { tone: "ok", text: "Your password was updated. Sign in with your new password." },
};
