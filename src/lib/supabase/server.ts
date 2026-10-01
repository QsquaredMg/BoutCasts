import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Pass `eventId` when loading a Live Vote by its link, so private events load
 * for link holders (see createEventClient in ./client).
 */
export async function createClient(opts?: { eventId?: string }) {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(opts?.eventId ? { global: { headers: { "x-event-id": opts.eventId } } } : {}),
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing sessions.
          }
        },
      },
    }
  );
}
