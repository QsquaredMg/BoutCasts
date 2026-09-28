import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safeNext";

const OTP_TYPES: EmailOtpType[] = ["signup", "email", "recovery", "invite", "magiclink", "email_change"];

// Handles Supabase email links (sign-up confirmation, password reset, magic
// link). Supports both link styles:
//  - ?token_hash=...&type=...  (works on any device/browser — preferred)
//  - ?code=...                  (PKCE; only works in the browser that asked)
// Whatever happens, the user lands on a page that tells them what to do next
// instead of a bare error.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const next = safeNext(searchParams.get("next"));
  const isRecovery = next.startsWith("/reset-password") || searchParams.get("type") === "recovery";
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const errorCode = searchParams.get("error_code");

  const fail = (notice: string) =>
    NextResponse.redirect(
      isRecovery
        ? `${origin}/forgot-password?notice=${notice}`
        : `${origin}/login?notice=${notice}${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`
    );

  if (errorCode) return fail("link_expired");

  const supabase = await createClient();

  if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail("link_expired");
    return NextResponse.redirect(`${origin}${type === "recovery" ? "/reset-password" : next}`);
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
    // Supabase already confirmed the email before redirecting here; the code
    // exchange only fails because the link was opened in a different browser
    // or app (e.g. the Gmail in-app browser). Reset links need a new request.
    return fail(isRecovery ? "link_expired" : "verify_other_device");
  }

  return fail("link_expired");
}
