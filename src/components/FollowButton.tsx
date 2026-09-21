"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";

export default function FollowButton({
  targetId,
  initialFollowing,
}: {
  targetId: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const supabase = createClient();
  const { showToast } = useToast();

  async function toggle() {
    setBusy(true);
    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }
    if (following) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", user.id)
        .eq("followed_id", targetId);
      setFollowing(false);
      showToast("Unfollowed", "info");
    } else {
      await supabase
        .from("follows")
        .insert({ follower_id: user.id, followed_id: targetId });
      setFollowing(true);
      showToast("Now following", "success");
    }
    setBusy(false);
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className="btn-outline rounded-lg border px-4 py-2 text-sm font-bold"
      style={
        following
          ? { background: "var(--blue-soft)", borderColor: "var(--blue)", color: "var(--blue)" }
          : { background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)" }
      }
    >
      {following ? "Following" : "Follow"}
    </button>
  );
}
