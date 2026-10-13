import { storyResponse } from "@/lib/og/cardRoute";

// Shareable portrait graphic (1080x1350) for a trivia game.
export async function GET(_req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return storyResponse("trivia", code);
}
