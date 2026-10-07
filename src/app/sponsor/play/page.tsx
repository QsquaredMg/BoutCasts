import type { Metadata } from "next";
import Funnel, { type Theme } from "@/components/funnel/Funnel";
import { SponsorVisual } from "@/components/funnel/FunnelVisuals";

export const metadata: Metadata = {
  title: "Sponsor BoutCasts: put your brand where fans cheer",
  description:
    "Get your logo, your ad or your prizes in front of fans at band battles, halftime shows, school events and live votes. Plans from $500 a month.",
};

const theme: Theme = {
  deep: "#0b0b12",
  deep2: "#1c1c2b",
  accent: "#ffc531",
  accentInk: "#0b0b12",
  accentDark: "#9a6a00",
  gold: "#ffc531",
  goldGlow: "rgba(255,197,49,.5)",
  glow: "rgba(255,197,49,.34)",
  glow2: "rgba(255,255,255,.07)",
  soft: "#d4d4e2",
  paper: "#f7f6f2",
};

// Keep these plans in step with PLANS in components/SponsorApplyForm.tsx.
export default function SponsorFunnel() {
  return (
    <Funnel
      theme={theme}
      kicker="Sponsor BoutCasts"
      title={["Be seen", "where fans", "[[cheer.]]"]}
      lede="Put your brand on the bouts people actually watch: band battles, halftime shows, school events and live votes. Your logo, your ad or your prizes, in front of a crowd that is paying attention."
      primary={{ label: "Become a sponsor", href: "/sponsor" }}
      secondary={{ label: "Already a sponsor? Upload ads", href: "/sponsor/creatives" }}
      fine="Pick a plan today and we'll follow up to activate your logo, links and placement."
      visual={<SponsorVisual />}
      ticker={["Presented by you", "Pre-roll ads", "Bracket sponsorships", "Prizes powered by you", "Monthly engagement reports", "Local reach", "School and league events"]}
      stepsTitle="From hello to on screen"
      stepsLede="Choose how you want to show up, send your logo, and we handle the rest."
      steps={[
        { title: "Choose a plan", body: "Bronze, Silver or Gold, depending on how much of BoutCasts you want to carry your name." },
        { title: "Pick your placement", body: "A commercial, a full bracket, one bout, a bout you design, or prizes." },
        { title: "Send your assets", body: "Add your logo, link and ad. Upload and track your ads in one place." },
        { title: "Watch it run", body: "We activate your placement and, on Silver and up, send monthly engagement reports." },
      ]}
      featuresTitle="Five ways to show up"
      featuresLede="From a light touch to owning the whole tournament."
      features={[
        { icon: "🎬", title: "Platform-wide commercial", body: "Your :15 or :30 spot plays before clips across BoutCasts. Priced by weekly impressions and reported with view counts.", span: 3, hot: true },
        { icon: "🏆", title: "Sponsor a full bracket", body: "Your logo and colors on every match, from Round 1 to the Champion, with one prize pool for the whole run.", span: 3 },
        { icon: "🥊", title: "Sponsor a single bout", body: "Back one matchup or category with your branding and a prize. The lightest way onto a live bout.", span: 2 },
        { icon: "🎨", title: "Fully curated bout", body: "You set the category, theme and invited competitors. We host the voting and deliver the prizes.", span: 2 },
        { icon: "🎁", title: "Prizes powered by you", body: "Supply the prizes and we tag them \"Prizes brought to you by\" your brand across bouts we run.", span: 2 },
      ]}
      usesTitle="Who sponsors"
      uses={[
        { emoji: "🍔", title: "Local restaurants", body: "Be the name on the game-night crowd's mind and plate." },
        { emoji: "🚗", title: "Dealerships", body: "Own a bracket and put your name in every matchup." },
        { emoji: "🏦", title: "Credit unions and banks", body: "Show up for the schools and teams your members care about." },
        { emoji: "🎓", title: "Colleges", body: "Recruit by sponsoring the battles and showcases students love." },
        { emoji: "🏥", title: "Health systems", body: "Sponsor community events with positive, family-friendly reach." },
        { emoji: "👟", title: "Apparel and brands", body: "Supply prizes and get tagged on every winner moment." },
      ]}
      tiers={{
        eyebrow: "Plans",
        title: "Pick your level",
        lede: "Monthly plans for logos and category sponsorships. Commercials are priced by impressions.",
        cards: [
          { label: "Bronze", price: "$500", unit: "/mo", sub: "Your name on a category", perks: ["Logo and link on a category of your choice", "\"Presented by\" credit on that category's bouts", "Listed on the sponsors page"], cta: { label: "Choose Bronze", href: "/sponsor" } },
          { label: "Silver", price: "$1,500", unit: "/mo", sub: "Back a whole bracket", perks: ["Everything in Bronze", "Sponsor a full bracket, not just one category", "Monthly engagement report (votes, reach)"], cta: { label: "Choose Silver", href: "/sponsor" }, hot: true, tag: "Most popular" },
          { label: "Gold", price: "$5,000", unit: "/mo", sub: "Title sponsor", perks: ["Everything in Silver", "Title-sponsor badge across the whole platform", "First pick of bracket or bout to sponsor", "Priority placement in engagement reporting"], cta: { label: "Choose Gold", href: "/sponsor" } },
        ],
        note: "Platform-wide commercials and prize sponsorships are quoted separately. Pick them on the sponsor form and we'll follow up.",
      }}
      faq={[
        { q: "What do I need to get started?", a: "A logo, a link to your site and your contact details. Ads can be uploaded after you sign up." },
        { q: "How will I know it's working?", a: "Silver and Gold plans get a monthly engagement report with votes and reach. Commercials are reported back with view counts." },
        { q: "Can I choose where my brand appears?", a: "Yes. You can pick a category, a bracket or a single bout, or design a whole bout yourself." },
        { q: "Is there a contract?", a: "Plans are monthly. We'll confirm the details with you when we follow up to activate your placement." },
        { q: "Can I sponsor a school event?", a: "Yes. Mention the event on the sponsor form and we'll follow up with you." },
      ]}
      closing={{
        headline: "Get on screen.",
        body: "Choose your plan and we'll take it from there.",
        primary: { label: "Become a sponsor", href: "/sponsor" },
        secondary: { label: "Upload your ads", href: "/sponsor/creatives" },
      }}
      crossLinks={[
        { label: "Competitions", href: "/competitions/play" },
        { label: "Predictions", href: "/predictions/play" },
        { label: "School voting", href: "/schools" },
      ]}
    />
  );
}
