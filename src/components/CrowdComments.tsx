"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BoutComment } from "@/lib/types";

type Props = {
  boutId: string;
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function CrowdComments({ boutId }: Props) {
  const supabase = createClient();
  const [comments, setComments] = useState<BoutComment[]>([]);
  const [signedIn, setSignedIn] = useState(false);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      setSignedIn(!!userData.user);

      const { data } = await supabase
        .from("bout_comments")
        .select("*, profiles(username)")
        .eq("bout_id", boutId)
        .order("created_at", { ascending: false })
        .limit(100);
      setComments((data ?? []) as BoutComment[]);
    }
    load();
  }, [boutId, supabase]);

  async function handlePost(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setError(null);
    setPosting(true);

    const { data: userData } = await supabase.auth.getUser();
    const user = userData.user;
    if (!user) {
      setError("Sign in to comment.");
      setPosting(false);
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("bout_comments")
      .insert({ bout_id: boutId, user_id: user.id, body: text.trim() })
      .select("*, profiles(username)")
      .single();

    setPosting(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setComments((prev) => [inserted as BoutComment, ...prev]);
    setText("");
  }

  return (
    <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--border)" }}>
      <div
        className="mb-3 text-sm font-bold"
        style={{ fontFamily: "var(--font-display)" }}
      >
        Crowd Talk{" "}
        <span className="font-normal" style={{ color: "var(--text-faint)" }}>
          ({comments.length})
        </span>
      </div>

      {signedIn ? (
        <form onSubmit={handlePost} className="mb-4 flex items-center gap-2">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Say something about this bout..."
            maxLength={500}
            className="flex-1 rounded-[10px] border px-3.5 py-2.5 text-sm"
            style={{ borderColor: "var(--border)", background: "var(--surface)" }}
          />
          <button
            type="submit"
            disabled={posting || !text.trim()}
            className="flex-shrink-0 rounded-[10px] px-4 py-2.5 text-sm font-bold disabled:opacity-50"
            style={{ fontFamily: "var(--font-display)", background: "var(--text)", color: "var(--bg)" }}
          >
            Post
          </button>
        </form>
      ) : (
        <p className="mb-4 text-sm" style={{ color: "var(--text-faint)" }}>
          <a href="/login" className="font-semibold underline" style={{ color: "var(--red)" }}>
            Sign in
          </a>{" "}
          to join the conversation.
        </p>
      )}

      {error && (
        <p className="mb-3 text-sm" style={{ color: "var(--red)" }}>
          {error}
        </p>
      )}

      <div className="flex flex-col gap-3.5">
        {comments.length === 0 && (
          <p className="text-sm" style={{ color: "var(--text-faint)" }}>
            No comments yet — be the first to weigh in.
          </p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-2.5">
            <span
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={{ background: "var(--text-dim)", color: "#fff" }}
            >
              {(c.profiles?.username ?? "?").slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold">{c.profiles?.username ?? "Anonymous"}</span>
                <span className="text-xs" style={{ color: "var(--text-faint)" }}>
                  {timeAgo(c.created_at)}
                </span>
              </div>
              <p className="mt-0.5 text-sm" style={{ color: "var(--text-dim)" }}>
                {c.body}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
