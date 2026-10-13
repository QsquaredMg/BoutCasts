import type { Metadata } from "next";
import Link from "next/link";
import JoinForm from "@/components/trivia/JoinForm";

export const metadata: Metadata = {
  title: "Live Trivia",
  description: "Phones in, scores on the big screen. Team trivia, stump-the-room rounds and real-world calls for live events.",
};

const STEPS = [
  ["Write or draft a pack", "Organizers and admins write their own questions, or have AI draft a pack that you review before it can go live."],
  ["Put the big screen up", "Open the big screen on the projector. It shows the join code, QR, question, countdown and leaderboard."],
  ["Everyone plays on their phone", "Scan, pick a name, answer. Faster correct answers score more. Use a one-time 2× Double or a Hint."],
  ["Team up or go solo", "Team mode splits the room into two sides and adds each side's scores together."],
];

export default function TriviaHome() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-10">
      <div className="text-center">
        <h1 className="text-4xl font-black" style={{ fontFamily: "var(--font-display)" }}>Got a code?</h1>
        <p className="mb-5 mt-2 text-sm" style={{ color: "var(--text-faint)" }}>Enter the code on the screen to join the game.</p>
        <JoinForm />
      </div>

      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        {STEPS.map(([t, d], i) => (
          <div key={t} className="rounded-2xl border p-4">
            <p className="text-xs font-black" style={{ color: "#c81f3c" }}>STEP {i + 1}</p>
            <p className="font-bold">{t}</p>
            <p className="mt-1 text-sm" style={{ color: "var(--text-dim)" }}>{d}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 rounded-2xl p-6 text-center text-white" style={{ background: "linear-gradient(160deg,#2a1260,#0a0e1a)" }}>
        <p className="text-xl font-black">Hosting an event?</p>
        <p className="mx-auto mt-1 max-w-md text-sm opacity-80">Band battles, homecoming, reunions, classrooms, watch parties. Build a question pack and run the room.</p>
        <Link href="/trivia/packs" className="mt-4 inline-block rounded-xl px-5 py-3 font-black text-black" style={{ background: "#ffc531" }}>
          Build a question pack
        </Link>
      </div>
    </div>
  );
}
