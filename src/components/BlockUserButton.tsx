"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Block / unblock another user. Blocking hides their comments from you and
// stops either of you from following or challenging the other.
export default function BlockUserButton({
  targetId,
  targetName,
  initialBlocked = false,
  onChange,
  className = "text-xs font-semibold",
}: {
  targetId: string;
  targetName?: string | null;
  initialBlocked?: boolean;
  onChange?: (blocked: boolean) => void;
  className?: string;
}) {
  const supabase = createClient();
  const [blocked, setBlocked] = useState(initialBlocked);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      window.location.href = "/login";
      return;
    }
    if (!blocked) {
      const ok = window.confirm(
        `Block ${targetName ? "@" + targetName : "this user"}? You won't see their comments, and neither of you can follow or challenge the other. You can unblock any time in Settings.`
      );
      if (!ok) return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = blocked
      ? await supabase.from("user_blocks").delete().eq("blocker_id", userData.user.id).eq("blocked_id", targetId)
      : await supabase.rpc("block_user", { p_target: targetId });
    setBusy(false);
    if (err) {
      setError("Couldn't update. Try again.");
      return;
    }
    setBlocked(!blocked);
    onChange?.(!blocked);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={className}
      style={{ color: "var(--text-faint)" }}
      title={error ?? undefined}
    >
      {error ? "Try again" : blocked ? "Unblock" : "Block"}
    </button>
  );
}
