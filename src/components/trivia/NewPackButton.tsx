"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function NewPackButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function create() {
    const title = window.prompt("Name your pack (for example: HBCU Band History)");
    if (!title || title.trim().length < 2) return;
    setBusy(true);
    const sb = createClient();
    const { data: u } = await sb.auth.getUser();
    if (!u.user) return router.push("/login?next=/trivia/packs");
    const { data, error } = await sb.from("trivia_packs").insert({ owner_id: u.user.id, title: title.trim() }).select("id").single();
    setBusy(false);
    if (error) setErr(error.message);
    else router.push(`/trivia/packs/${data.id}`);
  }
  return (
    <span>
      <button onClick={create} disabled={busy} className="rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-50" style={{ background: "#c81f3c" }}>
        + New pack
      </button>
      {err && <span className="ml-2 text-xs text-red-600">{err}</span>}
    </span>
  );
}
