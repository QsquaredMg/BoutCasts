import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Drafts trivia questions with Claude. Everything lands as UNREVIEWED: a pack cannot go live
// until a person has read and checked each question (enforced in the database too).
// Needs ANTHROPIC_API_KEY in the environment. TRIVIA_AI_MODEL overrides the model.
export const maxDuration = 60;

const DAILY_LIMIT = 80; // AI questions per account per rolling 24h

type Draft = { kind?: string; prompt?: string; options?: string[]; correct_index?: number; explanation?: string };

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "AI drafting isn't switched on yet (ANTHROPIC_API_KEY is not set)." }, { status: 503 });

  const supabase = await createClient();
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  let body: { packId?: string; topic?: string; count?: number; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const topic = String(body.topic ?? "").trim().slice(0, 200);
  const notes = String(body.notes ?? "").trim().slice(0, 600);
  const count = Math.max(3, Math.min(15, Math.floor(Number(body.count) || 10)));
  if (!body.packId || topic.length < 3) return NextResponse.json({ error: "Add a topic (at least 3 characters)." }, { status: 400 });

  const { data: pack } = await supabase.from("trivia_packs").select("id").eq("id", body.packId).maybeSingle();
  if (!pack) return NextResponse.json({ error: "Pack not found." }, { status: 404 });

  // Admins have no daily cap.
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", u.user.id).maybeSingle();
  const isAdmin = !!me?.is_admin;

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count: used } = isAdmin
    ? { count: 0 }
    : await supabase
        .from("trivia_questions")
        .select("id, trivia_packs!inner(owner_id,source)", { count: "exact", head: true })
        .eq("trivia_packs.owner_id", u.user.id)
        .eq("trivia_packs.source", "ai")
        .gte("created_at", since);
  if (!isAdmin && (used ?? 0) + count > DAILY_LIMIT)
    return NextResponse.json({ error: `Daily AI limit reached (${DAILY_LIMIT} questions per day). Try again tomorrow or write questions by hand.` }, { status: 429 });

  const prompt = `Write ${count} trivia questions for a live event crowd.
Topic: ${topic}
${notes ? `Organizer notes: ${notes}\n` : ""}
Rules:
- Only include facts you are highly confident are true and widely documented. If unsure, leave the question out rather than guess.
- Each question has 4 short answer options and exactly one correct answer. Wrong options must be plausible but clearly wrong to someone who knows the topic.
- Mix difficulty: a few easy, mostly medium, one or two hard.
- Make about 2 of them "stump" questions: a common misconception where the crowd may split.
- Keep the tone fun and respectful toward every community. Avoid anything demeaning, political attacks, or content about private individuals.
- The explanation is one sentence that states why the answer is right.
Reply with ONLY a JSON array, no other text. Each item: {"kind":"mc" or "stump","prompt":string,"options":[4 strings],"correct_index":0-3,"explanation":string}`;

  const model = process.env.TRIVIA_AI_MODEL || "claude-sonnet-5-5";
  let text = "";
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model, max_tokens: 8000, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) return NextResponse.json({ error: `AI service error (${r.status}). Try again in a moment.` }, { status: 502 });
    const j = await r.json();
    text = (j.content ?? []).filter((c: { type?: string }) => c.type === "text" || c.type === undefined).map((c: { text?: string }) => c.text ?? "").join("");
  } catch {
    return NextResponse.json({ error: "Couldn't reach the AI service." }, { status: 502 });
  }

  const items = parseDrafts(text);
  if (items.length === 0) {
    console.error("trivia generate: unreadable AI reply", text.slice(0, 500));
    return NextResponse.json({ error: "The AI reply wasn't readable. Try again, or make the topic more specific." }, { status: 502 });
  }

  const { data: last } = await supabase.from("trivia_questions").select("position").eq("pack_id", pack.id).order("position", { ascending: false }).limit(1);
  let pos = (last?.[0]?.position ?? -1) + 1;
  const rows = items
    .filter((d) => d && typeof d.prompt === "string" && Array.isArray(d.options) && d.options.length === 4 && d.options.every((o) => typeof o === "string" && o.trim()) && Number.isInteger(d.correct_index) && d.correct_index! >= 0 && d.correct_index! < 4)
    .slice(0, count)
    .map((d) => ({
      pack_id: pack.id,
      position: pos++,
      kind: d.kind === "stump" ? "stump" : "mc",
      prompt: d.prompt!.trim().slice(0, 400),
      options: d.options!.map((o) => o.trim().slice(0, 80)),
      correct_index: d.correct_index,
      explanation: typeof d.explanation === "string" ? d.explanation.trim().slice(0, 500) : null,
      reviewed: false,
    }));
  if (rows.length === 0) return NextResponse.json({ error: "No usable questions came back. Try a more specific topic." }, { status: 502 });

  const { error } = await supabase.from("trivia_questions").insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  await supabase.from("trivia_packs").update({ source: "ai", ai_topic: topic, status: "review" }).eq("id", pack.id);
  return NextResponse.json({ added: rows.length });
}

// Pulls every complete {...} object out of the reply, so a code fence, a short preface, a trailing
// note or a reply cut off mid-list still yields the questions that arrived intact.
function parseDrafts(text: string): Draft[] {
  const clean = text.replace(/```(?:json)?/gi, "");
  try {
    const m = clean.match(/\[[\s\S]*\]/);
    const whole = JSON.parse(m ? m[0] : clean);
    if (Array.isArray(whole)) return whole as Draft[];
  } catch {
    /* fall through to object-by-object scan */
  }
  const out: Draft[] = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === "{") { if (depth === 0) start = i; depth++; }
    else if (ch === "}" && depth > 0) {
      depth--;
      if (depth === 0 && start >= 0) {
        try { out.push(JSON.parse(clean.slice(start, i + 1)) as Draft); } catch { /* skip */ }
        start = -1;
      }
    }
  }
  return out;
}
