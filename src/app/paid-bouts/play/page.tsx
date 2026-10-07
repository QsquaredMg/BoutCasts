import type { Metadata } from "next";
import Funnel, { type Theme } from "@/components/funnel/Funnel";
import { ReceiptVisual } from "@/components/funnel/FunnelVisuals";
import { MAX_ENTRY_FEE_CENTS, MIN_ENTRY_FEE_CENTS, PLATFORM_FEE_PCT, money } from "@/lib/paidBouts";

const MAIL_HREF = `mailto:support@boutcasts.com?subject=${encodeURIComponent("Paid bout request")}`;

export const metadata: Metadata = {
  title: "Paid Bouts: competitions with published rules and prizes",
  description:
    "Entry-fee competitions where the rules, how winners are chosen and the exact payout order are posted before anyone pays. If the minimum isn't met, everyone is refunded.",
};

const theme: Theme = {
  deep: "#06241b",
  deep2: "#0b3b2c",
  accent: "#18c08a",
  accentInk: "#04261b",
  accentDark: "#0b8a62",
  gold: "#ffc531",
  goldGlow: "rgba(255,197,49,.5)",
  glow: "rgba(24,192,138,.5)",
  glow2: "rgba(255,197,49,.12)",
  soft: "#c4e8da",
  paper: "#f3f7f5",
};

export default function PaidBoutsFunnel() {
  return (
    <Funnel
      theme={theme}
      kicker="Paid Bouts"
      title={["Real stakes.", "Rules [[posted]]", "up front."]}
      lede="Competitions with an entry fee and prizes. Before anyone pays, they see the rules, how winners are chosen and exactly where the money goes. Miss the minimum entries and every fee is refunded."
      primary={{ label: "Browse open bouts", href: "/paid-bouts" }}
      secondary={{ label: "Talk to us about hosting", href: MAIL_HREF }}
      fine="Paid bouts are opened by our team, one at a time, after we review the rules."
      visual={<ReceiptVisual />}
      ticker={["Rules posted first", "Prizes set up front", "Full refund if the minimum isn't met", "Clear payout order", "Fair judging", "No surprises"]}
      stepsTitle="No fine print"
      stepsLede="Every number that matters is on the page before a single entry fee is paid."
      steps={[
        { title: "Read the rules", body: "Each bout posts its rules, its judging method, the fee, the prizes and the deadline." },
        { title: "Enter and pay", body: `Pay the entry fee by card. Fees run from ${money(MIN_ENTRY_FEE_CENTS)} to ${money(MAX_ENTRY_FEE_CENTS)} depending on the bout.` },
        { title: "Competition runs", body: "The bout closes at its deadline. If the minimum entries weren't reached, it's cancelled and everyone is refunded." },
        { title: "Prizes paid", body: "Winners are chosen the way the rules say they will be, and prizes are paid before the organizer takes a cut." },
      ]}
      featuresTitle="Built to be trusted"
      featuresLede="Entrants should never have to wonder how the money works. So we spell it out."
      features={[
        { icon: "📜", title: "Rules before payment", body: "Entrants read the rules and the judging method before they can enter. Nothing is hidden behind the checkout.", span: 3, hot: true },
        { icon: "↩️", title: "Minimum or refund", body: "Every bout sets a minimum number of entries. Fall short and all entry fees go back.", span: 3 },
        { icon: "🧾", title: "Fixed payout order", body: `BoutCasts keeps ${PLATFORM_FEE_PCT}% of entry fees. Prizes are paid next. The organizer receives what's left, only after both.`, span: 2 },
        { icon: "🏅", title: "Prizes set in advance", body: "Prize amounts are fixed when the bout is created, up to ten places. They don't change after people enter.", span: 2 },
        { icon: "🔐", title: "Open or invite-only", body: "Run it for everyone, or keep it to the people you invite.", span: 2 },
      ]}
      usesTitle="Where it fits"
      uses={[
        { emoji: "🎤", title: "Talent contests", body: "Singers, rappers and performers compete for a posted prize." },
        { emoji: "💃", title: "Dance and step battles", body: "Crews enter, judges or the crowd decide, prizes are paid by the rules." },
        { emoji: "🎬", title: "Creator challenges", body: "Short-video and creative contests with a clear judging method." },
        { emoji: "🎓", title: "Scholarship showdowns", body: "Entry-supported contests where prizes go to students." },
        { emoji: "🏟️", title: "Event promotions", body: "Add a paid competition to a festival, tournament or fan day." },
        { emoji: "🤝", title: "Fundraisers", body: "Let the organizer's share support a team, club or cause." },
      ]}
      tiers={{
        eyebrow: "The math",
        title: "How the money splits",
        lede: "The same three steps for every paid bout, in this order.",
        cards: [
          { label: "1. BoutCasts fee", price: `${PLATFORM_FEE_PCT}%`, sub: "Of all entry fees", perks: ["Covers payment processing", "Covers running the bout", "Taken first"], cta: { label: "Browse open bouts", href: "/paid-bouts" } },
          { label: "2. Prizes", price: "Fixed", sub: "Set before entries open", perks: ["Up to ten places", "Posted on the bout page", "Paid before the organizer"], cta: { label: "Browse open bouts", href: "/paid-bouts" }, hot: true, tag: "Winners come first" },
          { label: "3. Organizer", price: "The rest", sub: "After the fee and every prize", perks: ["Grows as more people enter", "Paid only after steps 1 and 2", "Refunded in full if the bout is cancelled"], cta: { label: "Host a paid bout", href: MAIL_HREF } },
        ],
        note: "Amounts shown in the example above are samples. Each bout posts its own fee, minimum, prizes and rules.",
      }}
      faq={[
        { q: "What if not enough people enter?", a: "If a bout doesn't reach its minimum number of entries by the deadline, it's cancelled and every entry fee is refunded in full." },
        { q: "How are winners chosen?", a: "However the bout's posted judging method says: the crowd, a panel, or a mix. Winners aren't picked by random draw." },
        { q: "Who can host a paid bout?", a: "Our team opens paid bouts one at a time. Tell us what you're planning and we'll review the rules with you." },
        { q: "Are paid bouts available everywhere?", a: "Contest rules differ by state, so we review each bout before it opens. If a bout isn't open for your area, we'll say so." },
        { q: "Can I keep it to invited players only?", a: "Yes. A bout can be invite-only so just your people can enter." },
      ]}
      closing={{
        headline: "Bring the stakes.",
        body: "See what's open now, or tell us about the bout you want to host.",
        primary: { label: "Browse open bouts", href: "/paid-bouts" },
        secondary: { label: "Talk to us about hosting", href: MAIL_HREF },
      }}
      crossLinks={[
        { label: "Free competitions", href: "/competitions/play" },
        { label: "Showcases", href: "/showcase/play" },
        { label: "Sponsors", href: "/sponsor/play" },
      ]}
    />
  );
}
