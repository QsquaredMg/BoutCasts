"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type TriviaKind = "mc" | "stump" | "predict";

export type TriviaState = {
  game: { id: string; code: string; title: string; mode: "solo" | "team"; teamA: string; teamB: string; status: "lobby" | "question" | "reveal" | "done"; pos: number; total: number };
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
};

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
