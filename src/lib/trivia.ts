"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { contrastRatio } from "@/lib/liveVoteEvents/roomTheme";

export type TriviaKind = "mc" | "stump" | "predict";

export type TriviaState = {
  game: { id: string; code: string; title: string; mode: "solo" | "team"; teamA: string; teamB: string; status: "lobby" | "question" | "reveal" | "done"; pos: number; total: number; packId?: string };
  question: null | {
    pos: number; kind: TriviaKind; prompt: string; options: string[]; seconds: number; points: number;
    remaining: number; hide: number[]; correct: number | null; explanation: string | null;
    counts: Record<string, number>; needsOutcome: boolean;
  };
  board: { name: string; team: "a" | "b" | null; score: number }[];
  teams: { a: number; b: number; na: number; nb: number };
  mine: null | { choice: number; points: number; doubled: boolean };
  me: null | { id: string; name: string; team: "a" | "b" | null; score: number; doubleUsed: boolean; hintUsed: boolean; rank: number };
  players: number;
  brand?: TriviaBrand | null;
  sponsors?: TriviaSponsor[];
  break?: TriviaBreak | null;
};

// A sponsor commercial the host is playing right now.
export type TriviaBreak = { id: string; name: string; logo: string | null; url: string; kind: "video" | "image" | null };

export type TriviaSponsor = { id?: string; name: string; logo: string | null; link: string | null; level: "title" | "gold" | "supporter"; commercial?: boolean };

// A pack's look: every field is optional. Blank = the standard BoutCasts trivia look.
export type TriviaBrand = { name: string | null; logo: string | null; color: string | null; bg: string | null; image: string | null; opacity: number };

/** Colors and images to paint a trivia screen with, falling back to the default purple look. */
export function triviaTheme(b: TriviaBrand | null | undefined, base: string) {
  const accent = b?.color || "#ffc531";
  // Screens use white text, so a light background color would be unreadable: ignore it.
  const bgOk = !!b?.bg && contrastRatio(b.bg, "#ffffff") >= 3;
  const onAccent = contrastRatio(accent, "#000000") >= contrastRatio(accent, "#ffffff") ? "#000" : "#fff";
  return {
    accent,
    onAccent,
    background: bgOk ? (b!.bg as string) : base,
    image: b?.image || null,
    opacity: (b?.opacity ?? 100) / 100,
    logo: b?.logo || null,
    name: b?.name || null,
  };
}

export const KIND_LABEL: Record<TriviaKind, string> = { mc: "Trivia", stump: "Stump the room", predict: "Call it" };
export const OPTION_COLORS = ["#e5263b", "#1b4fe4", "#f2a900", "#16a34a"];

export function playerToken(): string {
  try {
    let t = localStorage.getItem("bc_trivia_token");
    if (!t) {
      t = crypto.randomUUID();
      localStorage.setItem("bc_trivia_token", t);
    }
    return t;
  } catch {
    return "anon-" + Math.random().toString(36).slice(2, 12);
  }
}

/** Polls the game state every ~1.2s. The server clock decides the timer; `deadline` is a local ms timestamp. */
export function useTriviaState(code: string, token: string | null, everyMs = 1200) {
  const [state, setState] = useState<TriviaState | null>(null);
  const [missing, setMissing] = useState(false);
  const [deadline, setDeadline] = useState(0);
  const sb = useRef(createClient());
  const [now, setNow] = useState(0);

  useEffect(() => {
    let stop = false;
    async function pull() {
      const { data, error } = await sb.current.rpc("trivia_state", { p_code: code, p_token: token });
      if (stop) return;
      if (!error && data === null) setMissing(true);
      if (!error && data) {
        const s = data as TriviaState;
        setState(s);
        setMissing(false);
        if (s.question && s.game.status === "question") setDeadline(Date.now() + s.question.remaining * 1000);
      }
    }
    pull();
    const id = setInterval(pull, everyMs);
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => {
      stop = true;
      clearInterval(id);
      clearInterval(t);
    };
  }, [code, token, everyMs]);

  const secondsLeft = state?.game.status === "question" ? Math.max(0, now ? Math.ceil((deadline - now) / 1000) : Math.ceil(state.question?.remaining ?? 0)) : 0;
  const refresh = async () => {
    const { data } = await sb.current.rpc("trivia_state", { p_code: code, p_token: token });
    if (data) {
      const s = data as TriviaState;
      setState(s);
      if (s.question && s.game.status === "question") setDeadline(Date.now() + s.question.remaining * 1000);
    }
  };
  return { state, missing, secondsLeft, refresh };
}
