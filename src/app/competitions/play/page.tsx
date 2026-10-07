import type { Metadata } from "next";
import Funnel, { type Theme } from "@/components/funnel/Funnel";
import { BracketVisual } from "@/components/funnel/FunnelVisuals";

export const metadata: Metadata = {
  title: "Run your own bracket competition",
  description:
    "Dance battles, band battles, rap and talent contests. Collect entries by link, approve who competes, and let the crowd vote every round. Winners advance automatically.",
};

const theme: Theme = {
  deep: "#0b1030",
  deep2: "#171f57",
  accent: "#ff5a36",
  accentInk: "#ffffff",
  accentDark: "#d23a17",
  gold: "#ffc531",
  goldGlow: "rgba(255,197,49,.55)",
  glow: "rgba(255,90,54,.55)",
  glow2: "rgba(255,197,49,.14)",
  soft: "#cfd5f5",
  paper: "#f4f6fb",
};

export default function CompetitionsFunnel() {
  return (
    <Funnel
      theme={theme}
      kicker="Bracket competitions"
      live
      title={["Settle it", "in [[the]]", "bracket."]}
      lede="Run your own dance-off, band battle, rap cypher or talent show. Share one entry link, pick who makes the bracket, and the crowd votes every round until one act is left standing."
      primary={{ label: "Start a competition", href: "/competitions" }}
      secondary={{ label: "See live matchups", href: "/matchups" }}
      fine="Set up takes a few minutes. Keep it link-only for a school or private group, or list it publicly."
      visual={<BracketVisual />}
      ticker={["Dance battles", "Band battles", "Rap cyphers", "Talent shows", "Step shows", "Cheer-offs", "Halftime showdowns", "Open mics"]}
      stepsTitle="Four steps. One champion."
      stepsLede="You stay in charge of who competes. The crowd decides who wins."
      steps={[
        { title: "Create it", body: "Name your competition, add the rules and prizes, and choose public or link-only." },
        { title: "Collect entries", body: "Share the entry link. Performers submit their clips, and you see every entry in one place." },
        { title: "Approve and seed", body: "Pick the entries you want and build the bracket. Nobody gets in without your approval." },
        { title: "Crowd votes", body: "Fans vote each matchup. Winners move up on their own until a champion is crowned." },
      ]}
      featuresTitle="Everything a tournament needs"
      featuresLede="No spreadsheets, no group chats full of screenshots. The bracket runs itself once it starts."
      features={[
        { icon: "🔗", title: "One entry link", body: "Post it on a flyer, a story or a morning announcement. Entries land in your dashboard.", span: 3, hot: true },
        { icon: "✅", title: "You approve every entry", body: "Look at each clip before it goes in and only approve what fits your rules.", span: 3 },
        { icon: "🏆", title: "Automatic advancement", body: "When a round closes, winners move to the next matchup without you lifting a finger.", span: 2 },
        { icon: "🔒", title: "Public or link-only", body: "List it for everyone to find, or keep it private for your school, league or group.", span: 2 },
        { icon: "📱", title: "Votes from any phone", body: "Fans watch both sides and vote in seconds. No app to install.", span: 2 },
      ]}
      usesTitle="Your stage, your rules"
      uses={[
        { emoji: "💃", title: "Dance battles", body: "Crews and solo dancers go head to head, round by round." },
        { emoji: "🎺", title: "Band battles", body: "Drumline and section showdowns the whole stadium can weigh in on." },
        { emoji: "🎤", title: "Rap and talent", body: "Open-mic energy with a real bracket and a real winner." },
        { emoji: "🏫", title: "School contests", body: "Keep it link-only so only your students and families can enter." },
        { emoji: "🎪", title: "Festivals and events", body: "Turn a stage event into a tournament that people follow for weeks." },
        { emoji: "🏘️", title: "Community and church", body: "Youth talent nights and fundraisers with a fair, visible vote." },
      ]}
      faq={[
        { q: "Who decides who competes?", a: "You do. Every entry waits for your approval before it can appear in the bracket." },
        { q: "How do winners advance?", a: "The crowd votes each matchup. When the round ends, the winner moves to the next one automatically." },
        { q: "Can I keep it private?", a: "Yes. Leave the public listing off and only people with your entry link can enter." },
        { q: "What if I want a simple poll instead of a bracket?", a: "Use Live Vote. It's built for class elections, pageants and quick polls with a live tally. See the school voting page." },
        { q: "Can I add prizes?", a: "You can describe prizes and rules in your competition details. If you want an entry fee and published payouts, ask us about Paid Bouts." },
      ]}
      closing={{
        headline: "Bracket up.",
        body: "Create your competition now and have your entry link ready to share today.",
        primary: { label: "Start a competition", href: "/competitions" },
        secondary: { label: "How BoutCasts works", href: "/how-it-works" },
      }}
      crossLinks={[
        { label: "School voting", href: "/schools" },
        { label: "Showcases", href: "/showcase/play" },
        { label: "Debates", href: "/debates/play" },
      ]}
    />
  );
}
