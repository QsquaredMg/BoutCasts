"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function JoinForm() {
  const [code, setCode] = useState("");
  const router = useRouter();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (code.trim().length >= 4) router.push(`/trivia/${code.trim().toUpperCase()}/play`);
      }}
      className="mx-auto flex max-w-sm gap-2"
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        maxLength={6}
        placeholder="CODE"
        aria-label="Game code"
        className="min-w-0 flex-1 rounded-xl border px-4 py-3 text-center text-2xl font-black uppercase tracking-widest"
      />
      <button className="rounded-xl px-5 py-3 text-lg font-black text-black" style={{ background: "#ffc531" }}>Join</button>
    </form>
  );
}
