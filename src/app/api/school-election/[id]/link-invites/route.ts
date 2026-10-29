import { NextResponse } from "next/server";
import { isOpen, requireElectionAccess } from "@/lib/schoolElection";

// Email each student their own code and the voting link. Teachers can also download the list instead.
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const owner = await requireElectionAccess(id);
  if ("error" in owner) return owner.error;
  const { admin, election } = owner;
  if (!election.link_voting) return NextResponse.json({ error: "Turn on voting by link first." }, { status: 400 });
  if (!isOpen(election)) return NextResponse.json({ error: "Voting isn't open. Send the emails once voting is open." }, { status: 400 });
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "Email isn't set up yet. Download the list and hand out the codes instead." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const resend = body?.resend === true;
  let q = admin.from("election_voters").select("id, name, code, email").eq("election_id", id).not("email", "is", null).is("voted_at", null).order("name").limit(500);
  if (!resend) q = q.is("emailed_at", null);
  const { data: voters, error } = await q;
  if (error) return NextResponse.json({ error: "Couldn't load the roster." }, { status: 500 });
  const list = voters ?? [];
  if (!list.length) return NextResponse.json({ sent: 0, failed: 0, remaining: 0 });

  const origin = new URL(req.url).origin.replace("://boutcasts.com", "://www.boutcasts.com");
  const link = `${origin}/school-election/${id}/vote`;
  const from = process.env.RESEND_FROM || "BoutCasts <info@boutcasts.com>";
  const close = election.closes_at ? ` Voting closes ${new Date(election.closes_at).toUTCString()}.` : "";
  const title = election.title;

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < list.length; i += 100) {
    const chunk = list.slice(i, i + 100);
    const payload = chunk.map((v) => ({
      from,
      to: [v.email as string],
      subject: `Your voting code for ${title}`,
      text: `Hi ${v.name},\n\nIt's time to vote in "${title}".\n\n1. Open ${link}\n2. Enter your name exactly as it appears on the class list\n3. Enter your personal code: ${v.code}\n\nThis code is just for you. You vote once for each office, and you can come back until voting closes.${close}\n\nPlease don't share your code.`,
      html:
        `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#111;max-width:560px">` +
        `<p>Hi ${esc(v.name)},</p><p>It&rsquo;s time to vote in <b>${esc(title)}</b>.</p>` +
        `<p><a href="${link}" style="display:inline-block;background:#1b4fe4;color:#fff;font-weight:bold;padding:12px 22px;border-radius:999px;text-decoration:none">Go to the ballot</a></p>` +
        `<p>Enter your name as it appears on the class list and your personal code:</p>` +
        `<p style="font-size:24px;font-weight:bold;letter-spacing:3px;font-family:monospace">${esc(v.code)}</p>` +
        `<p>You vote once for each office, and you can come back until voting closes.${esc(close)}</p>` +
        `<p style="color:#666;font-size:13px">This code is just for you. Please don&rsquo;t share it.</p></div>`,
    }));
    const res = await fetch("https://api.resend.com/emails/batch", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" }, body: JSON.stringify(payload) }).catch(() => null);
    if (res && res.ok) {
      sent += chunk.length;
      await admin.from("election_voters").update({ emailed_at: new Date().toISOString() }).in("id", chunk.map((v) => v.id));
    } else {
      failed += chunk.length;
      if (res) console.error("link-invites resend error", res.status, (await res.text().catch(() => "")).slice(0, 300));
    }
  }
  const { count } = await admin.from("election_voters").select("id", { count: "exact", head: true }).eq("election_id", id).not("email", "is", null).is("voted_at", null).is("emailed_at", null);
  return NextResponse.json({ sent, failed, remaining: resend ? 0 : (count ?? 0) });
}
