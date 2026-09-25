import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const CANONICAL_HOST = "www.boutcasts.com";

export async function proxy(request: NextRequest) {
  // Anyone who lands on the live site through a *.vercel.app address
  // (e.g. boutcasts-app.vercel.app) is sent to www.boutcasts.com, so the
  // hosting provider never shows in the address bar, links or search results.
  // Preview deployments (VERCEL_ENV=preview) are left alone for testing.
  const host = request.headers.get("host") ?? "";
  if (process.env.VERCEL_ENV === "production" && host.endsWith(".vercel.app")) {
    const url = new URL(request.nextUrl.pathname + request.nextUrl.search, `https://${CANONICAL_HOST}`);
    return NextResponse.redirect(url, 308);
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
