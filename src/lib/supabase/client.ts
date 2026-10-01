import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Client for a Live Vote's voting page. It tells the database which event
 * this browser was linked to (x-event-id), which is what lets private events
 * load for people with the link while staying hidden from everyone else.
 * Create it once per page (e.g. in useState), not on every render.
 */
export function createEventClient(eventId: string) {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { isSingleton: false, global: { headers: { "x-event-id": eventId } } }
  );
}
