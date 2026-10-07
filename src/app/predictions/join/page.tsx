import type { Metadata } from "next";
import JoinByCode from "@/components/JoinByCode";
import PredHero from "@/components/PredHero";

export const metadata: Metadata = {
  title: "Join a private prediction game",
  description: "Enter the 6-letter code from your invite to join a private prediction game.",
  robots: { index: false },
};

export default function JoinPage() {
  return (
    <>
      <PredHero small kicker="🔒 Private game" title="Join a private game" sub="Enter the 6-letter code from your invite. Private games are always free for players." />
      <div className="pt-body">
        <div className="bc-card p-5">
          <JoinByCode />
        </div>
      </div>
    </>
  );
}
