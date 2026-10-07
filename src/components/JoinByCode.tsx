"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function JoinByCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function go(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!/^[A-Z]{6}$/.test(c)) {
      setError("Codes are 6 letters.");
      return;
    }
    router.push(`/predictions/join/${c}`);
  }

  return (
    <form onSubmit={go} className="bc-card flex flex-col gap-3 p-5">
      <label className="text-xs font-bold">
        Invite code
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 6).toUpperCase())}
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          placeholder="ABCDEF"
          className="mt-1 h-14 w-full rounded-xl border bg-transparent px-3 text-center text-2xl font-black tracking-[0.35em]"
          style={{ borderColor: "var(--border)" }}
        />
      </label>
      {error && <p role="alert" className="text-sm font-semibold" style={{ color: "var(--red)" }}>{error}</p>}
      <button type="submit" className="bc-btn-solid rounded-full px-5 py-3 text-sm font-bold">Join game</button>
    </form>
  );
}
