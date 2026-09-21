"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";

const PRESETS = [10, 25, 50];

export default function ContributeButton({ poolId }: { poolId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContribute() {
    setError(null);

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      router.push("/login");
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.rpc("contribute_to_pool", {
      p_pool_id: poolId,
      p_amount: amount,
    });
    setSubmitting(false);

    if (error) {
      const msg = error.message.replace(/^.*: /, "");
      setError(msg);
      showToast(msg, "error");
      return;
    }

    setOpen(false);
    showToast(`Chipped in ${amount} BB — thanks for backing this!`, "success");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-full px-3 py-1.5 text-xs font-bold"
        style={{ background: "var(--gold-soft)", color: "var(--gold)" }}
      >
        💰 Chip in
      </button>
    );
  }

  return (
    <div
      className="mt-2 rounded-xl border p-3"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="mb-2 flex gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setAmount(p)}
            className="rounded-full px-3 py-1 text-xs font-bold"
            style={{
              background: amount === p ? "var(--gold-soft)" : "var(--surface-2)",
              color: amount === p ? "var(--gold)" : "var(--text-dim)",
            }}
          >
            {p} BB
          </button>
        ))}
        <input
          type="number"
          min={1}
          value={amount}
          onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
          className="w-20 rounded-full border px-2 py-1 text-xs outline-none"
          style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
        />
      </div>
      {error && (
        <p className="mb-2 text-xs" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          onClick={handleContribute}
          disabled={submitting}
          className="bc-btn-solid rounded-full px-3 py-1.5 text-xs disabled:opacity-60"
        >
          {submitting ? "Chipping in…" : `Chip in ${amount} BB`}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded-full border px-3 py-1.5 text-xs font-semibold"
          style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
