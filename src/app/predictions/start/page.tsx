import type { Metadata } from "next";
import PredHero from "@/components/PredHero";
import GoalChooser, { PREDICTION_GOALS } from "@/components/GoalChooser";

export const metadata: Metadata = {
  title: "Start a prediction game",
  description: "Choose a single game, a pick'em, a prediction bracket or a private pool.",
};

export default function StartPredictionPage() {
  return (
    <>
      <PredHero small kicker="Bout Predictions" title="Start a prediction game" sub="Pick the format. Players always play free." />
      <div className="pt-body">
        <GoalChooser goals={PREDICTION_GOALS} />
      </div>
    </>
  );
}
