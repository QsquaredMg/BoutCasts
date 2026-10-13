import { SITE } from "./types";

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: cents % 100 ? 2 : 0 })}`;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) + " ET" : null;

type Parts = { fbLink: string; igLink: string };
const links = (path: string): Parts => ({ fbLink: `${SITE}${path}`, igLink: "Link in bio 🔗 boutcasts.com" });

export function boutLaunch(b: { a: string; b: string; closes_at: string | null; prize: string | null; path: string }) {
  const { fbLink, igLink } = links(b.path);
  const close = when(b.closes_at);
  const make = (link: string) =>
    [
      `🔥 NEW BOUT LIVE: ${b.a} vs ${b.b}`,
      "",
      "Who takes it? You decide 👇",
      `🅰️ ${b.a}`,
      `🅱️ ${b.b}`,
      b.prize ? `\n🎁 ${b.prize}` : "",
      "",
      `🗳️ Cast your vote${close ? ` before ${close}` : " now"}: ${link}`,
      "💬 Drop your pick in the comments: A or B?",
      "🔁 Tag a friend who needs to see this one.",
    ].filter((l, i, arr) => !(l === "" && arr[i - 1] === "")).join("\n");
  return { facebook: make(fbLink), instagram: make(igLink) };
}

export function paidBoutLaunch(b: { title: string; feeCents: number; poolCents: number; prizes: { place: number; cents: number }[]; deadline: string; spotsLeft: number | null; path: string }) {
  const { fbLink, igLink } = links(b.path);
  const ord = ["🥇 1st", "🥈 2nd", "🥉 3rd"];
  const make = (link: string) =>
    [
      `💰 ${b.poolCents ? `${money(b.poolCents)} PRIZE POOL` : "NEW PAID BOUT"}: ${b.title}`,
      "",
      `Entry is just ${money(b.feeCents)}. Show what you've got and win.`,
      ...b.prizes.slice(0, 3).map((p) => `${ord[p.place - 1] ?? `#${p.place}`}: ${money(p.cents)}`),
      "",
      `⏳ Entries close ${when(b.deadline)}${b.spotsLeft !== null && b.spotsLeft <= 20 ? ` · only ${b.spotsLeft} spot${b.spotsLeft === 1 ? "" : "s"} left` : ""}`,
      `👉 Enter now: ${link}`,
      "🔁 Know someone who'd win this? Tag them below.",
      "Full rules and payout terms on the entry page.",
    ].join("\n");
  return { facebook: make(fbLink), instagram: make(igLink) };
}
