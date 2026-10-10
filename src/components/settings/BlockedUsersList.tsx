"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import BlockUserButton from "@/components/BlockUserButton";

type Row = { blocked_id: string; username: string | null };

export default function BlockedUsersList() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("user_blocks")
        .select("blocked_id, profiles!user_blocks_blocked_id_fkey(username)")
        .order("created_at", { ascending: false });
      setRows(
        ((data ?? []) as unknown as { blocked_id: string; profiles: { username: string | null } | null }[]).map((r) => ({
          blocked_id: r.blocked_id,
          username: r.profiles?.username ?? null,
        }))
      );
    }
    load();
  }, [supabase]);

  return (
    <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h2 className="mb-1 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Blocked users
      </h2>
      <p className="mb-3 text-sm" style={{ color: "var(--text-dim)" }}>
        You won&apos;t see comments from people you block, and neither of you can follow or challenge the other.
        To block someone, open their profile or tap Block on their comment.
      </p>
      {rows === null ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-faint)" }}>You haven&apos;t blocked anyone.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.blocked_id} className="flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }}>
              {r.username ? (
                <Link href={`/profile/${encodeURIComponent(r.username)}`} className="text-sm font-semibold">
                  @{r.username}
                </Link>
              ) : (
                <span className="text-sm">Unknown user</span>
              )}
              <BlockUserButton
                targetId={r.blocked_id}
                targetName={r.username}
                initialBlocked
                onChange={(blocked) => {
                  if (!blocked) setRows((cur) => (cur ?? []).filter((x) => x.blocked_id !== r.blocked_id));
                }}
                className="text-sm font-bold"
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
