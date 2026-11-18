import { NextResponse } from "next/server";
import { verifyHandoff } from "@/lib/sbdPartner";

// Public: turns a School-B-Doo handoff token into the school's name and look, so the election form can start filled in.
export async function GET(req: Request) {
  const h = verifyHandoff(new URL(req.url).searchParams.get("token") ?? "");
  if (!h) return NextResponse.json({ error: "This link has expired. Go back to School-B-Doo and start again." }, { status: 400 });
  return NextResponse.json({ schoolName: h.sname, logo: h.logo, color: h.color }, { headers: { "Cache-Control": "no-store" } });
}
