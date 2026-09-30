import type { Instrumentation } from "next";

// Server errors (pages, API routes, server actions) go to the admin error log.
export const onRequestError: Instrumentation.onRequestError = async (err, request) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { reportAppError } = await import("@/lib/errors/report");
    const message = err instanceof Error ? err.message : String(err);
    const digest = typeof err === "object" && err !== null && "digest" in err ? String(err.digest) : null;
    const ua = request.headers["user-agent"];
    await reportAppError({
      source: "server",
      message,
      digest,
      path: `${request.method} ${request.path}`,
      userAgent: Array.isArray(ua) ? ua[0] : ua ?? null,
    });
  } catch {
    // never let error reporting throw
  }
};
