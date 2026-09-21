"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AppealButton({ submissionId }: { submissionId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const supabase = createClient();

  async function submit() {
    if (!message.trim()) return;
    setState("busy");
    const { error } = await supabase.rpc("appeal_submission", {
      p_submission_id: submissionId,
      p_message: message.trim(),
    });
    setState(error ? "error" : "done");
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-full border px-3 py-1 text-xs font-bold"
        style={{ borderColor: "var(--gold)", color: "var(--gold)" }}
      >
        Appeal
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
                  Appeal submitted
                </p>
                <p className="text-sm" style={{ color: "var(--text-faint)" }}>
                  A moderator will take another look. This page will update once they do.
                </p>
                <button
                  onClick={() => window.location.reload()}
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
                    Appeal this rejection
                  </h3>
                  <button onClick={() => setOpen(false)} style={{ color: "var(--text-faint)" }}>
                    ✕
                  </button>
                </div>
                <p className="mb-4 text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
                  Explain why this submission should be reconsidered. You get one appeal per
                  rejected entry — a moderator will review it and make a final call.
                </p>

                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Why should this be reconsidered?"
                  className="mb-4 w-full resize-none rounded-lg border px-3 py-2 text-sm"
                  style={{ borderColor: "var(--border)", background: "var(--surface)" }}
                />

                {state === "error" && (
                  <p className="mb-3 text-sm" style={{ color: "var(--red)" }}>
                    Couldn&apos;t submit that appeal — try again.
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
                    disabled={state === "busy" || !message.trim()}
                    onClick={submit}
                    className="rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-60"
                    style={{ background: "var(--gold)", color: "#2a1c00" }}
                  >
                    Submit appeal
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
