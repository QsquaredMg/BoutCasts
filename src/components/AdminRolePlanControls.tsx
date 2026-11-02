"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Grant a free Student Roles plan by username, or remove a free plan from a row.
export default function AdminRolePlanControls({ userId }: { userId?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: "grant" | "revoke") {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/role-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, userId, username: name }) });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setMsg(d.error ?? "Something went wrong.");
    setName("");
    router.refresh();
  }

  if (userId) {
    return (
      <button disabled={busy} onClick={() => run("revoke")} className="text-xs font-bold underline">
        {busy ? "Working..." : "Remove free plan"}{msg ? ` (${msg})` : ""}
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Organizer username" className="rounded-lg border px-3 py-1.5 text-sm" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }} />
      <button disabled={busy || !name.trim()} onClick={() => run("grant")} className="bc-btn-solid rounded-full px-4 py-1.5 text-sm font-bold">Give free plan</button>
      {msg && <span className="text-sm" style={{ color: "var(--text-dim)" }}>{msg}</span>}
    </div>
  );
}
