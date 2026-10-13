import { ogResponse } from "@/lib/og/cardRoute";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage({ params }: { params: Promise<{ id: string }> }) {
  const { id: id } = await params;
  return ogResponse("bout", id);
}
