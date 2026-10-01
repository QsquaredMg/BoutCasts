"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

// Marks the listed notifications read once the Activity page has shown them.
export default function MarkNotificationsRead({ ids }: { ids: string[] }) {
  useEffect(() => {
    if (ids.length === 0) return;
    createClient().from("notifications").update({ is_read: true }).in("id", ids).then(() => {});
  }, [ids]);
  return null;
}
