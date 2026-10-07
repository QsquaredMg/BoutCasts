import type { Metadata } from "next";
import Funnel, { type Theme } from "@/components/funnel/Funnel";
import { DebateVisual } from "@/components/funnel/FunnelVisuals";
import { MAX_DEBATE_SECONDS } from "@/lib/debates";

const MAIL_HREF = `mailto:support@boutcasts.com?subject=${encodeURIComponent("Debate request")}`;
const MAX_MIN = MAX_DEBATE_SECONDS / 60;

export const metadata: Metadata = {
  title: "Video debates: pick a side and make your case",
  description: `Answer on video in ${MAX_MIN} minutes or less, watch your opponent before you respond, and let the crowd or a panel of judges pick the winner.`,
};

const theme: Theme = {
  deep: "#0a1030",
  deep2: "#12206b",
  accent: "#4f8bff",
  accentInk: "#ffffff",
  accentDark: "#1d4ed8",
  gold: "#ffc531",
  goldGlow: "rgba(255,197,49,.5)",
  glow: "rgba(79,139,255,.55)",
  glow2: "rgba(226,60,90,.2)",
  soft: "#cdd8f7",
  paper: "#f4f6fb",
};

export default function DebatesFunnel() {
  return (
    <Funnel
      theme={theme}
      kicker="Video debates"
      live
      title={["Pick a side.", "Make your", "[[case.]]"]}
      lede={`Answer on video in ${MAX_MIN} minutes or less. Watch your opponent before you reply. The crowd, a panel of judges, or both decide who argued it best.`}
      primary={{ label: "Join a debate", href: "/debates" }}
      secondary={{ label: "Request a debate topic", href: MAIL_HREF }}
      fine="Debates are posted by our team. Browse what's open and sign up."
      visual={<DebateVisual />}
      ticker={["For", "Against", "Opening statements", "Rebuttals", "Closing statements", "Judges and crowd", "Bracket debates", "Panel debates"]}
      stepsTitle="Argue it out"
      stepsLede="Real debate structure, built for phones and busy schedules."
      steps={[
        { title: "Choose a topic", body: "Browse debates open for debaters and sign up for the side you want to argue." },
        { title: "Record your turn", body: `Record or upload a video up to ${MAX_MIN} minutes long. You have a set window to respond.` },
        { title: "Watch and answer", body: "Watch your opponent's video before you reply. Openings, rebuttals and closings keep it organized." },
        { title: "Winner decided", body: "Voting opens when the rounds finish. The winner is picked by the crowd, judges or a mix." },
      ]}
      featuresTitle="A debate that runs itself"
      featuresLede="Turn clocks, structured rounds and fair scoring, without anyone refereeing a group chat."
      features={[
        { icon: "🎥", title: `${MAX_MIN}-minute video turns`, body: "Record in the app or upload a clip. Short turns keep every answer sharp.", span: 3, hot: true },
        { icon: "⏳", title: "Turn clocks", body: "Each turn has a deadline. Miss it and you can forfeit the round, so everyone stays on schedule.", span: 3 },
        { icon: "🏁", title: "Open or bracket", body: "Run a single open debate or a bracket where winners face off until one debater remains.", span: 2 },
        { icon: "⚖️", title: "Crowd, judges or both", body: "Score by audience vote, a judging panel or a weighted blend of the two.", span: 2 },
        { icon: "🙈", title: "Tally hidden", body: "Keep the running count secret until voting ends so early votes don't sway the room.", span: 2 },
      ]}
      usesTitle="Where debate lives"
      uses={[
        { emoji: "🏫", title: "Classrooms", body: "Structured argument practice students can do from anywhere." },
        { emoji: "🎓", title: "Debate teams", body: "Run tournaments across a school, a district or a league." },
        { emoji: "🏛️", title: "Civic groups", body: "Let neighbors hear both sides and weigh in respectfully." },
        { emoji: "⛪", title: "Youth programs", body: "Build confidence with a topic, a side and three minutes." },
        { emoji: "🎙️", title: "Creators", body: "Settle the hot take with a real opponent and a real vote." },
        { emoji: "👥", title: "Panel debates", body: "One video with several debaters and a winner chosen by judges and viewers." },
      ]}
      faq={[
        { q: "How long is each turn?", a: `Up to ${MAX_MIN} minutes per video.` },
        { q: "Do I see my opponent's argument first?", a: "Yes. You watch your opponent's video before you record your response." },
        { q: "What if I miss my turn?", a: "Each turn has a deadline. Missing it counts against you and can end in a forfeit." },
        { q: "Who picks the winner?", a: "The debate sets it: the crowd, a panel of judges, or a weighted mix of both." },
        { q: "Can my school run its own debates?", a: "Yes. Send us the topic and format and we'll set it up, or run a quick class vote on our school voting page." },
      ]}
      closing={{
        headline: "Your turn.",
        body: "See which debates are open and claim your side.",
        primary: { label: "Join a debate", href: "/debates" },
        secondary: { label: "Request a debate topic", href: MAIL_HREF },
      }}
      crossLinks={[
        { label: "Showcases", href: "/showcase/play" },
        { label: "Competitions", href: "/competitions/play" },
        { label: "School voting", href: "/schools" },
      ]}
    />
  );
}
