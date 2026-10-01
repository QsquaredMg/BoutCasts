import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Battle Rules",
  description: "How rap and roast battles work on BoutCasts.",
};

const SECTION_HEADING = "mb-2 mt-8 text-lg font-bold";
const BODY = "text-sm leading-relaxed";
const LIST = "ml-5 list-disc space-y-1.5 text-sm leading-relaxed";

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="mb-1 text-2xl font-bold" style={{ fontFamily: "var(--font-display)" }}>
        Battle Rules
      </h1>
      <p className="mb-6 text-sm" style={{ color: "var(--text-faint)" }}>
        These rules apply to rap and roast bouts, on top of our{" "}
        <a href="/terms" className="underline">Terms of Service</a>.
      </p>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Rap battles
      </h2>
      <ul className={LIST} style={{ color: "var(--text-dim)" }}>
        <li>Perform your own words. Beats must be original, royalty-free, or licensed to you.</li>
        <li>One verse per round, 60 to 90 seconds. Both sides get the same length.</li>
        <li>Trash talk about skill, style, and delivery is fair. Slurs, threats, and attacks on someone&apos;s family, health, or identity are not.</li>
        <li>If an organizer sets a beat or prompt, both rappers use it. No replacing an entry after it is approved.</li>
        <li>Each bracket uses either crowd voting or judges plus crowd, with the weights shown before it starts. Ties go to the judges, or to a one-hour re-vote if there are none.</li>
        <li>One vote per account per bout. Votes from bots, vote-buying, or coordinated fraud are removed.</li>
      </ul>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Roast battles
      </h2>
      <ul className={LIST} style={{ color: "var(--text-dim)" }}>
        <li>Roast only your opponent or someone who agreed to be roasted. No private individuals, no minors outside school-run events, no public figures.</li>
        <li>Both roasters accept these rules before the round starts.</li>
        <li>Off limits: slurs; race, religion, disability, sexuality, gender identity, or immigration status; physical traits a person can&apos;t change; family tragedy; health or mental health; abuse; threats; private information.</li>
        <li>Fair game: skills, performance history, public wins and losses, and the roaster&apos;s own choices.</li>
        <li>One minute per roast, same number of rounds each. Rebuttals come in the next round.</li>
        <li>School and youth events are clean and PG, run by an organizer with approval from participants (and parents for minors).</li>
        <li>Comments follow the same rules as the roast. Use Report to flag anything that crosses the line.</li>
      </ul>

      <h2 className={SECTION_HEADING} style={{ fontFamily: "var(--font-display)" }}>
        Reports and appeals
      </h2>
      <p className={BODY} style={{ color: "var(--text-dim)" }}>
        Anyone signed in can report a bout or comment. Moderators may reject or remove entries that
        break these rules, and repeat violations can lose entry privileges. A rejected entry can be
        appealed once, and the moderator&apos;s second decision is final.
      </p>
    </div>
  );
}
