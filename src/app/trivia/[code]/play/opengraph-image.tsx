import { ogResponse } from "@/lib/og/cardRoute";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return ogResponse("trivia", code);
}
