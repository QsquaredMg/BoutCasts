"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  opponentId: string;
  opponentName: string;
};

export default function ChallengeButton({ opponentId, opponentName }: Props) {
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState<"idle" | "sent" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function sendChallenge() {
    setSending(true);
    setErrorMsg(null);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const { error } = await supabase.from("challenges").insert({
      challenger_id: user.id,
      opponent_id: opponentId,
      message: message.trim() || null,
      status: "pending",
    });

    setSending(false);
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <span className="text-xs font-bold" style={{ color: "var(--blue)" }}>
        🥊 Challenge sent!
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border px-3 py-1 text-xs font-bold"
        style={{ borderColor: "var(--red)", background: "var(--red-soft)", color: "var(--red)" }}
      >
        🥊 Challenge
      </button>
    );
  }

  return (
    <div
      className="flex items-center gap-2 rounded-full border px-2 py-1"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={`Call out ${opponentName}...`}
        maxLength={280}
        className="w-40 border-none bg-transparent text-xs outline-none"
      />
      <button
        type="button"
        disabled={sending}
        onClick={sendChallenge}
        className="flex-shrink-0 rounded-full px-2.5 py-1 text-xs font-bold disabled:opacity-50"
        style={{ background: "var(--blue)", color: "#fff" }}
      >
        Send
      </button>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="flex-shrink-0 text-xs"
        style={{ color: "var(--text-faint)" }}
      >
        ✕
      </button>
      {errorMsg && <span className="text-xs" style={{ color: "var(--red)" }}>{errorMsg}</span>}
    </div>
  );
}
