export type DebateSide = "for" | "against";

export type DebateTopic = {
  id: string;
  statement: string;
  description: string | null;
  category_id: string | null;
  format: "open" | "bracket";
  bracket_size: number | null;
  rounds: number;
  turn_hours: number;
  voting_hours: number;
  scoring_mode: "crowd" | "judges" | "both";
  crowd_weight: number;
  hide_tally: boolean;
  status: "open" | "running" | "closed";
  champion_user_id: string | null;
  created_at: string;
};

export type DebateMatch = {
  id: string;
  topic_id: string;
  bracket_round: number | null;
  bracket_pos: number | null;
  next_match_id: string | null;
  for_user_id: string | null;
  against_user_id: string | null;
  status: "waiting" | "active" | "voting" | "final";
  current_round: number;
  turn_side: DebateSide;
  turn_due_at: string | null;
  voting_closes_at: string | null;
  strikes_for: number;
  strikes_against: number;
  winner_side: DebateSide | null;
  win_reason: "score" | "forfeit" | "bye" | null;
  crowd_for: number | null;
  crowd_against: number | null;
  judge_for: number | null;
  judge_against: number | null;
};

export type DebatePost = {
  id: string;
  match_id: string;
  round: number;
  side: DebateSide;
  user_id: string | null;
  source_type: "record" | "upload" | "link" | "missed";
  source_url: string | null;
  duration_seconds: number | null;
  created_at: string;
};

export const MAX_DEBATE_SECONDS = 180;

export const SIDE_LABEL: Record<DebateSide, string> = { for: "For", against: "Against" };
export const SIDE_COLOR: Record<DebateSide, string> = { for: "var(--red)", against: "var(--live)" };

export function roundLabel(round: number, total: number) {
  if (total === 1) return "Opening & closing";
  if (round === 1) return "Opening statements";
  if (round === total) return "Closing statements";
  return total === 3 ? "Rebuttals" : `Rebuttals (round ${round})`;
}

export function bracketRoundLabel(round: number, totalRounds: number) {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinals";
  if (fromEnd === 2) return "Quarterfinals";
  return `Round ${round}`;
}

export function formatDuration(seconds: number | null | undefined) {
  if (!seconds && seconds !== 0) return "";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export function timeLeft(iso: string | null, now = Date.now()) {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "due now";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m left`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ${mins % 60}m left`;
  return `${Math.round(hrs / 24)} days left`;
}

export function scoringLabel(t: Pick<DebateTopic, "scoring_mode" | "crowd_weight">) {
  if (t.scoring_mode === "crowd") return "Crowd vote";
  if (t.scoring_mode === "judges") return "Judges decide";
  return `Crowd ${t.crowd_weight}% · Judges ${100 - t.crowd_weight}%`;
}

export function youTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0] || null;
    if (!host.endsWith("youtube.com")) return null;
    if (u.pathname.startsWith("/shorts/") || u.pathname.startsWith("/embed/") || u.pathname.startsWith("/live/"))
      return u.pathname.split("/")[2] || null;
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

// Load the YouTube IFrame Player API once per page.
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: Record<string, (e: { target: YTPlayer; data?: number }) => void>;
    }
  ) => YTPlayer;
  PlayerState: { PLAYING: number; ENDED: number; PAUSED: number };
};
export type YTPlayer = {
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  playVideo: () => void;
  getDuration: () => number;
  getCurrentTime: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

let ytPromise: Promise<YTNamespace> | null = null;
export function loadYouTubeApi(): Promise<YTNamespace> {
  const w = window as unknown as { YT?: YTNamespace & { loaded?: number }; onYouTubeIframeAPIReady?: () => void };
  if (w.YT && w.YT.Player) return Promise.resolve(w.YT);
  if (ytPromise) return ytPromise;
  ytPromise = new Promise((resolve) => {
    const prev = w.onYouTubeIframeAPIReady;
    w.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(w.YT!);
    };
    const s = document.createElement("script");
    s.src = "https://www.youtube.com/iframe_api";
    s.async = true;
    document.head.appendChild(s);
  });
  return ytPromise;
}
