import type { Metadata } from "next";
import Funnel, { type Theme } from "@/components/funnel/Funnel";
import { ScorecardVisual } from "@/components/funnel/FunnelVisuals";

const MAIL_HREF = `mailto:support@boutcasts.com?subject=${encodeURIComponent("Showcase request")}`;

export const metadata: Metadata = {
  title: "Showcases: one video, a judging panel and the crowd",
  description:
    "Put a whole battle or talent show in one video. Invited judges score each group on private links while the crowd votes. Blend both into one result.",
};

const theme: Theme = {
  deep: "#170a35",
  deep2: "#2b1366",
  accent: "#8b5cf6",
  accentInk: "#ffffff",
  accentDark: "#6636dc",
  gold: "#ffc531",
  goldGlow: "rgba(255,197,49,.5)",
  glow: "rgba(139,92,246,.6)",
  glow2: "rgba(255,197,49,.12)",
  soft: "#dcd2fa",
  paper: "#f6f4fb",
};

export default function ShowcaseFunnel() {
  return (
    <Funnel
      theme={theme}
      kicker="Showcases with judges"
      title={["One video.", "Every group.", "[[Real]] scores."]}
      lede="Film the whole event once. Add every group with its start time, invite a panel of judges to score on their own private links, and let the crowd vote too. You choose how the two blend."
      primary={{ label: "Request a showcase", href: MAIL_HREF }}
      secondary={{ label: "See showcases in action", href: "/matchups" }}
      fine="Showcases are set up with our team so the judging and results are done right."
      visual={<ScorecardVisual />}
      ticker={["Band showcases", "Step shows", "Talent nights", "Cheer competitions", "Choir contests", "Pageants", "Battle nights", "Panel debates"]}
      stepsTitle="From recording to results"
      stepsLede="Judges don't need accounts. Fans don't need to hunt for the right clip."
      steps={[
        { title: "Add your video", body: "Upload it, record it or link an existing video. One video can hold the whole event." },
        { title: "List the groups", body: "Name each group and mark where it starts so viewers jump straight to their favorite." },
        { title: "Invite judges", body: "Each judge gets a private link. They score every group on four criteria." },
        { title: "Publish results", body: "Choose crowd only, judges only, or a blend. Set when voting closes." },
      ]}
      featuresTitle="Judging you can stand behind"
      featuresLede="Clear criteria, private scoring and a result everyone can see being built."
      features={[
        { icon: "🎬", title: "Start-time markers", body: "Every group links to its moment in the video, like 4:15 or 1:02:30.", span: 3, hot: true },
        { icon: "📝", title: "Four-point scorecards", body: "Judges score Skill, Creativity, Performance and Crowd appeal. Debates use Argument, Evidence, Rebuttal and Delivery.", span: 3 },
        { icon: "⚖️", title: "You set the blend", body: "Crowd only, judges only, or a weighted mix such as 50 / 50.", span: 2 },
        { icon: "🙈", title: "Hide the tally", body: "Keep the running count secret until voting closes so early leaders don't sway the room.", span: 2 },
        { icon: "⏱️", title: "A clear deadline", body: "Choose exactly when voting closes so everyone knows the cutoff.", span: 2 },
      ]}
      usesTitle="Made for big nights"
      uses={[
        { emoji: "🥁", title: "Band showcases", body: "Score every band in the lineup from a single recording." },
        { emoji: "🕺", title: "Step and dance shows", body: "Judges and fans weigh in on the same performance." },
        { emoji: "🎶", title: "Choir and talent", body: "Fair, visible scoring for events where taste is personal." },
        { emoji: "👑", title: "Pageants", body: "Private judge links keep scoring independent and orderly." },
        { emoji: "📣", title: "Cheer and spirit", body: "Let the crowd's energy count alongside the panel's marks." },
        { emoji: "🎙️", title: "Panel debates", body: "One video, several debaters, one winner chosen by judges and viewers." },
      ]}
      faq={[
        { q: "Do judges need an account?", a: "No. Each judge opens a private link and scores. Nothing to sign up for." },
        { q: "Can fans vote too?", a: "Yes. You can run crowd voting, judge scoring or a weighted blend of both." },
        { q: "Where does the video come from?", a: "Upload one, record it in the app, or link a video you already host." },
        { q: "Who creates a showcase?", a: "Our team sets them up for now. Send us the details and we'll build it with you." },
        { q: "Can I just run a quick vote instead?", a: "Yes. Live Vote is the fast way to run a poll with a live tally. See the school voting page." },
      ]}
      closing={{
        headline: "Bring the panel.",
        body: "Tell us about your event and we'll set up the video, the groups and the judging.",
        primary: { label: "Request a showcase", href: MAIL_HREF },
        secondary: { label: "Run a bracket instead", href: "/competitions/play" },
      }}
      crossLinks={[
        { label: "Competitions", href: "/competitions/play" },
        { label: "School voting", href: "/schools" },
        { label: "Debates", href: "/debates/play" },
      ]}
    />
  );
}
