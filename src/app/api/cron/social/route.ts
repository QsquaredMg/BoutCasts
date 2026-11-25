import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSocial } from "@/lib/social/run";

// Runs every 15 minutes (vercel.json), a few minutes after the score check. Queues newly finished results; in "auto" mode
// it also publishes them. Vercel sends CRON_SECRET as a bearer token.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runSocial(createAdminClient()));
}
