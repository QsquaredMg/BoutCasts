import { storyResponse } from "@/lib/og/cardRoute";

// Shareable portrait graphic (1080x1350) for the Share button.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: id } = await params;
  // ?format=story is the full-height 9:16 version for an Instagram Story.
  return storyResponse("livevote", id, new URL(req.url).searchParams.get("format") === "story");
}
