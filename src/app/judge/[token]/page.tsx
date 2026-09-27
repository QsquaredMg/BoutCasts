import type { Metadata } from "next";
import JudgePortal from "@/components/JudgePortal";

// Private judging link — keep it out of search engines and link previews.
export const metadata: Metadata = {
  title: "Judge scoring",
  robots: { index: false, follow: false },
};

export default async function JudgePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="mx-auto max-w-lg px-5 py-8">
      <JudgePortal token={token} />
    </div>
  );
}
