"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const REASONS = [
  "Inappropriate content",
  "Fake or duplicate entry",
  "Harassment",
  "Copyright issue",
  "Other",
];

export default function ReportButton({
  targetType,
  targetId,
}: {
  targetType: "bout" | "comment";
  targetId: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const supabase = createClient();

  async function submit() {
    setState("busy");
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      window.location.href = "/login";
      return;
    }
    const { error } = await supabase.from("reports").insert({
      reporter_id: userData.user.id,
      target_type: targetType,
      target_id: targetId,
      reason,
      details: details || null,
    });
    setState(error ? "error" : "done");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold"
        style={{ color: "var(--text-faint)" }}
      >
        Report
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-5"
          style={{ background: "rgba(15,14,10,0.45)" }}
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border p-5"
            style={{ background: "var(--surface)", borderColor: "var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {state === "done" ? (
              <div className="py-4 text-center">
                <div className="mb-2 text-2xl">✓</div>
                <p className="mb-1 font-bold" style={{ fontFamily: "var(--font-display)" }}>
                  Report submitted
                </p>
                <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                  Thanks — our moderators will take a look.
                </p>
                <button
                  onClick={() => setOpen(false)}
                  className="mt-4 rounded-lg px-4 py-2 text-sm font-bold"
                  style={{ background: "var(--text)", color: "var(--bg)" }}
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <div className="mb-1 flex items-start justify-between">
                  <h3 className="text-base font-bold" style={{ fontFamily: "var(--font-display)" }}>
                    Report this {targetType}
                  </h3>
                  <button onClick={() => setOpen(false)} style={{ color: "var(--text-faint)" }}>
                    ✕
                  </button>
                </div>
                <p className="mb-4 text-xs" style={{ color: "var(--text-faint)" }}>
                  Flag this for a moderator to review. Reports aren&apos;t anonymous to admins.
                </p>

                <label className="mb-1.5 block text-xs font-bold uppercase" style={{ color: "var(--text-dim)" }}>
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mb-3 w-full rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>

                <label className="mb-1.5 block text-xs font-bold uppercase" style={{ color: "var(--text-dim)" }}>
                  Details (optional)
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  rows={3}
                  className="mb-4 w-full resize-none rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                />

                {state === "error" && (
                  <p className="mb-3 text-sm" style={{ color: "var(--red)" }}>
                    Couldn&apos;t submit that report — try again.
                  </p>
                )}

                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setOpen(false)}
                    className="rounded-lg border px-4 py-2 text-sm font-bold"
                    style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
                  >
                    Cancel
                  </button>
                  <button
                    disabled={state === "busy"}
                    onClick={submit}
                    className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60"
                    style={{ background: "var(--red)", color: "#fff5f6" }}
                  >
                    Submit report
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
