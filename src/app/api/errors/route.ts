import { NextResponse } from "next/server";
import { reportAppError } from "@/lib/errors/report";

// Browser error reports from the error pages. Always answers 204 so a
// failure here never causes a second error on the page.
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown; digest?: unknown; path?: unknown };
    const message = typeof body.message === "string" ? body.message : "Unknown error";
    await reportAppError({
      source: "client",
      message,
      digest: typeof body.digest === "string" ? body.digest : null,
      path: typeof body.path === "string" ? body.path : null,
      userAgent: request.headers.get("user-agent"),
    });
  } catch {
    // ignore
  }
  return new NextResponse(null, { status: 204 });
}
