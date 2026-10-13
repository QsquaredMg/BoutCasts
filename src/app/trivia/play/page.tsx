import type { Metadata } from "next";
import Funnel, { type Theme } from "@/components/funnel/Funnel";
import { TriviaVisual } from "@/components/funnel/FunnelVisuals";
import JumbotronSim from "@/components/trivia/JumbotronSim";

const MAIL = `mailto:support@boutcasts.com?subject=${encodeURIComponent("Arena trivia demo")}`;

export const metadata: Metadata = {
  title: "Live trivia for stadiums, arenas and big rooms",
  description: "Put BoutCasts trivia on your video board. Fans scan a QR code, answer on their phones, and the crowd's scores light up the jumbotron.",
};

const theme: Theme = {
  deep: "#0a0e1a",
  deep2: "#151b2e",
  accent: "#ff4d63",
  accentInk: "#ffffff",
  accentDark: "#c81f3c",
  gold: "#ffc531",
  goldGlow: "rgba(255,197,49,.5)",
  glow: "rgba(255,77,99,.5)",
  glow2: "rgba(27,79,228,.28)",
  soft: "#d6dcf0",
  paper: "#f4f6fb",
};

export default function TriviaFunnel() {
  return (
    <Funnel
      theme={theme}
      kicker="Live trivia"
      live
      title={["Turn the whole", "arena into", "[[a game show.]]"]}
      lede="Fans scan the code on the video board, answer on their phones, and watch their section climb the leaderboard in real time. Built for stadiums, arenas, homecomings and any room with a big screen."
      primary={{ label: "Join a game", href: "/trivia" }}
      secondary={{ label: "Book an arena demo", href: MAIL }}
      fine="Have a code? Enter it at boutcasts.com/trivia. Hosting? Build a pack and go live."
      visual={<TriviaVisual />}
      midSlot={<JumbotronSim />}
      ticker={["Jumbotron ready", "Scan to join", "Section battles", "Team vs team", "Stump the room", "Call it", "2× Double", "Halftime shows", "Pep rallies", "Watch parties"]}
      stepsTitle="From kickoff to the final buzzer"
      stepsLede="One operator, one screen, thousands of phones."
      steps={[
        { title: "Build your pack", body: "Write your own questions or have AI draft a pack. Nothing goes live until a person has checked every question." },
        { title: "Put it on the board", body: "Open the big-screen view on any screen that can show a web page, or hand your control room the feed." },
        { title: "Fans scan and play", body: "A QR code and join code on the board. No app to download and no account to make." },
        { title: "Crowd reacts", body: "Faster right answers score more. See the answer split, the section battle and the top fans after every question." },
      ]}
      featuresTitle="Made for the big screen"
      featuresLede="Everything a venue operator and a game-day host need, and nothing that slows the show down."
      features={[
        { icon: "📺", title: "A board-ready screen", body: "Large type, high contrast and a live countdown, designed to read from the cheap seats.", span: 3, hot: true },
        { icon: "📱", title: "No app, no account", body: "Fans scan, pick a name and answer from their phone browser.", span: 3 },
        { icon: "🏟️", title: "Section and team battles", body: "Split the room into two teams and add up every fan's points on the board.", span: 2 },
        { icon: "🔮", title: "Call it", body: "Ask about something happening live and reveal the real result when it does.", span: 2 },
        { icon: "🤯", title: "Stump the room", body: "Show how the crowd split against the right answer. The reaction does the rest.", span: 2 },
        { icon: "🛡️", title: "Reviewed questions only", body: "AI-drafted packs stay locked until a human approves each question, so nothing surprises you on the board.", span: 3 },
        { icon: "📣", title: "Sponsor-friendly", body: "Open and close with your partners on the same screen. Ask us about presenting sponsor slots.", span: 3 },
      ]}
      usesTitle="Where it plays"
      uses={[
        { emoji: "🏟️", title: "Stadiums and arenas", body: "Halftime, timeouts and pre-game on the video board." },
        { emoji: "🎺", title: "HBCU homecomings", body: "Band, alumni and fan trivia that gets the whole stand involved." },
        { emoji: "⚾", title: "Minor league and college", body: "Between-innings and intermission games that sponsors can present." },
        { emoji: "🏫", title: "Pep rallies and assemblies", body: "Class against class, grade against grade, one gym." },
        { emoji: "🍻", title: "Bars and watch parties", body: "Trivia between plays, with a leaderboard on every TV." },
        { emoji: "🎤", title: "Conferences and reunions", body: "Icebreakers and keynotes where everyone plays at once." },
      ]}
      faq={[
        { q: "Do fans need to download anything?", a: "No. They scan the QR code or enter the code at boutcasts.com/trivia and play in their phone browser." },
        { q: "How do we get it on the video board?", a: "The big-screen view is a web page. Show it on any screen or media player that can open a browser, or give it to your control room as a feed. We'll walk your operator through it." },
        { q: "How many people can play?", a: "It's designed for big rooms. Tell us your crowd size and we'll run a test with you before game day so there are no surprises." },
        { q: "Who writes the questions?", a: "You do, or AI drafts them for you. Every AI question has to be read and approved by a person before it can run." },
        { q: "Can sponsors be part of it?", a: "Yes. Talk to us about presenting-sponsor slots and branded rounds." },
      ]}
      closing={{
        headline: "Make the next timeout the loudest one.",
        body: "Tell us about your venue and we'll set up a demo for your game-day team.",
        primary: { label: "Book an arena demo", href: MAIL },
        secondary: { label: "Build a question pack", href: "/trivia/packs" },
      }}
      crossLinks={[
        { label: "Live Vote events", href: "/host" },
        { label: "Predictions", href: "/predictions/play" },
        { label: "School voting", href: "/schools" },
      ]}
    />
  );
}
