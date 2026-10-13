import { SITE, type SocialDraft } from "./types";

const MEDAL = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];

const HEAD: Record<SocialDraft["kind"], string> = {
  bout: "🏆 BOUT RESULT",
  bracket: "🏆 BRACKET CHAMPION",
  livevote: "🗳️ THE VOTES ARE IN",
  predictions: "🔮 PREDICTION LEADERBOARD",
  trivia: "🧠 TRIVIA RESULTS",
  bout_launch: "🔥 NEW BOUT",
  paidbout_launch: "💰 NEW PAID BOUT",
};

function body(d: SocialDraft, link: string) {
  const lines: string[] = [`${HEAD[d.kind]}: ${d.title}`];
  if (d.winner) lines.push("", `${d.kind === "predictions" || d.kind === "trivia" ? "Top spot" : "Winner"}: ${d.winner} 👑${d.detail ? ` (${d.detail})` : ""}`);
  if (d.top10.length > 1) {
    lines.push("", `TOP ${d.top10.length}`);
    for (const r of d.top10) lines.push(`${MEDAL[r.rank - 1] ?? `${r.rank}.`} ${r.name}${r.score ? ` · ${r.score}` : ""}`);
  }
  lines.push("", "Think the crowd got it right? Weigh in on the next one 👇", link);
  return lines;
}

export function buildCaptions(d: SocialDraft, hashtags: string) {
  const url = `${SITE}${d.path}`;
  const facebook = [...body(d, url), "", hashtags].join("\n").trim();
  // Links aren't clickable in Instagram captions, so point to the bio link instead.
  const instagram = [...body(d, "Link in bio 🔗 boutcasts.com"), "", hashtags].join("\n").trim().slice(0, 2200);
  return { facebook, instagram };
}
