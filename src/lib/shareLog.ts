import { createClient } from "@/lib/supabase/client";

export type ShareTarget = { type: "bout" | "showcase" | "live_vote"; id: string };

/** Count a share or graphic save for sponsor reports. Fire-and-forget. */
export function logShare(target: ShareTarget | undefined, action: "share" | "save_graphic") {
  if (!target) return;
  createClient()
    .rpc("log_share", { p_type: target.type, p_id: target.id, p_action: action })
    .then(() => {});
}
