import { storyResponse } from "@/lib/og/cardRoute";

// Shareable portrait graphic (1080x1350) for the Share button.
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key: id } = await params;
  return storyResponse("bracket", id);
}
