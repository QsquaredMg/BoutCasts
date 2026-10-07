import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { loadReportByToken, periodLabel, placementLabel } from "@/lib/analytics/report";

export const dynamic = "force-dynamic";

const BLUE = rgb(0.106, 0.31, 0.894);
const INK = rgb(0.04, 0.055, 0.1);
const DIM = rgb(0.29, 0.318, 0.388);
const FAINT = rgb(0.482, 0.51, 0.588);
const SOFT = rgb(0.933, 0.945, 0.973);
const LINE = rgb(0.894, 0.906, 0.937);

// Standard PDF fonts only cover Latin-1; anything else becomes "?".
const clean = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "?");
const num = (v: number) => v.toLocaleString("en-US");
const ctr = (c: number, i: number) => (i > 0 ? `${((c / i) * 100).toFixed(1)}%` : "-");

async function embedRemote(doc: PDFDocument, url: string | null): Promise<PDFImage | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const isPng = bytes[0] === 0x89 && bytes[1] === 0x50;
    const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    if (isPng) return await doc.embedPng(bytes);
    if (isJpg) return await doc.embedJpg(bytes);
    return null;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const rep = await loadReportByToken(token);
  if (!rep) return new NextResponse("Report not found", { status: 404 });

  const doc = await PDFDocument.create();
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 612, H = 792, M = 40;
  const origin = new URL(req.url).origin;
  const [wordmark, advLogo] = await Promise.all([embedRemote(doc, `${origin}/boutcasts-wordmark.png`), embedRemote(doc, rep.sponsor.logo_url)]);

  let page: PDFPage = doc.addPage([W, H]);
  let y = H;

  const fit = (text: string, font: PDFFont, size: number, max: number) => {
    let t = clean(text);
    while (t.length > 1 && font.widthOfTextAtSize(t, size) > max) t = t.slice(0, -2);
    return t === clean(text) ? t : `${t.trimEnd()}...`;
  };
  const text = (s: string, x: number, yy: number, size: number, font: PDFFont = reg, color = INK, maxW?: number) =>
    page.drawText(maxW ? fit(s, font, size, maxW) : clean(s), { x, y: yy, size, font, color });
  const right = (s: string, xr: number, yy: number, size: number, font: PDFFont = reg, color = INK) =>
    page.drawText(clean(s), { x: xr - font.widthOfTextAtSize(clean(s), size), y: yy, size, font, color });

  const footer = () => {
    text("BoutCasts · www.boutcasts.com", M, 24, 8, reg, FAINT);
    right(`Report generated ${new Date(rep.generated_at).toLocaleDateString("en-US", { dateStyle: "medium", timeZone: "America/Chicago" })}`, W - M, 24, 8, reg, FAINT);
  };
  const ensure = (need: number) => {
    if (y - need < 50) {
      footer();
      page = doc.addPage([W, H]);
      y = H - M;
    }
  };

  // Header band
  page.drawRectangle({ x: 0, y: H - 150, width: W, height: 150, color: BLUE });
  page.drawRectangle({ x: M, y: H - 120, width: 150, height: 54, color: rgb(1, 1, 1), borderColor: rgb(1, 1, 1) });
  if (wordmark) {
    const s = Math.min(130 / wordmark.width, 38 / wordmark.height);
    page.drawImage(wordmark, { x: M + (150 - wordmark.width * s) / 2, y: H - 120 + (54 - wordmark.height * s) / 2, width: wordmark.width * s, height: wordmark.height * s });
  } else {
    text("BoutCasts", M + 16, H - 100, 16, bold, BLUE);
  }
  text("SPONSOR RESULTS", M, H - 138, 9, bold, rgb(1, 1, 1));
  if (advLogo) {
    const s = Math.min(130 / advLogo.width, 54 / advLogo.height);
    page.drawRectangle({ x: W - M - 150, y: H - 120, width: 150, height: 54, color: rgb(1, 1, 1) });
    page.drawImage(advLogo, { x: W - M - 150 + (150 - advLogo.width * s) / 2, y: H - 120 + (54 - advLogo.height * s) / 2, width: advLogo.width * s, height: advLogo.height * s });
  }

  y = H - 185;
  text(rep.sponsor.name, M, y, 24, bold, INK, W - 2 * M);
  y -= 18;
  text(periodLabel(rep), M, y, 10, reg, DIM);
  y -= 30;

  // Stat tiles (3 x 2)
  const t = rep.totals;
  const tiles: [string, string, string][] = [
    ["Ad views", num(t.ad_impressions), `${num(t.ad_unique_viewers)} unique viewers`],
    ["Ad clicks", num(t.ad_clicks), `${ctr(t.ad_clicks, t.ad_impressions)} click rate`],
    ["Votes on your matchups", num(t.votes), `${num(t.unique_accounts)} signed-in voters`],
    ["Shares", num(t.shares), "sponsored matchups shared"],
    ["Vote graphics opened", num(t.graphics), "each shows your logo"],
    ["Sponsored matchups", num(t.bouts), "your brand on the page"],
  ];
  const tw = (W - 2 * M - 20) / 3;
  tiles.forEach(([label, value, sub], i) => {
    const x = M + (i % 3) * (tw + 10);
    const ty = y - Math.floor(i / 3) * 70;
    page.drawRectangle({ x, y: ty - 58, width: tw, height: 62, color: SOFT });
    text(label, x + 10, ty - 14, 8.5, bold, DIM, tw - 20);
    text(value, x + 10, ty - 38, 20, bold, INK, tw - 20);
    text(sub, x + 10, ty - 52, 7.5, reg, FAINT, tw - 20);
  });
  y -= 150;

  // Daily impressions bar chart
  if (rep.daily.length > 1) {
    ensure(150);
    text("Ad views per day", M, y, 11, bold);
    y -= 12;
    const ch = 80, cw = W - 2 * M;
    const days = rep.daily.slice(-60);
    const max = Math.max(1, ...days.map((d) => d.impressions));
    page.drawLine({ start: { x: M, y: y - ch }, end: { x: M + cw, y: y - ch }, thickness: 0.5, color: LINE });
    const step = cw / days.length, bw = Math.max(1.5, Math.min(14, step * 0.65));
    days.forEach((d, i) => {
      const h = Math.max(d.impressions > 0 ? 1.5 : 0, (d.impressions / max) * ch);
      page.drawRectangle({ x: M + i * step + (step - bw) / 2, y: y - ch, width: bw, height: h, color: BLUE });
    });
    const lab = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    text(lab(days[0].day), M, y - ch - 11, 8, reg, FAINT);
    right(lab(days[days.length - 1].day), M + cw, y - ch - 11, 8, reg, FAINT);
    text(`Peak: ${num(max)}`, M + cw / 2 - 20, y - ch - 11, 8, reg, FAINT);
    y -= ch + 36;
  }

  // Table helper
  // A cell written as "main\nsub" draws a small gray second line under the main text.
  const table = (title: string, head: string[], widths: number[], rows: string[][], empty: string) => {
    ensure(60);
    text(title, M, y, 11, bold);
    y -= 16;
    if (rows.length === 0) {
      text(empty, M, y, 9, reg, FAINT);
      y -= 24;
      return;
    }
    const xs = widths.reduce<number[]>((acc, w, i) => [...acc, i === 0 ? M : acc[i - 1] + widths[i - 1]], []);
    const drawHead = () => {
      head.forEach((h, i) => (i === 0 ? text(h.toUpperCase(), xs[i], y, 7.5, bold, FAINT) : right(h.toUpperCase(), xs[i] + widths[i] - 8, y, 7.5, bold, FAINT)));
      y -= 6;
      page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: LINE });
      y -= 13;
    };
    drawHead();
    for (const r of rows) {
      if (y < 70) {
        ensure(9999);
        drawHead();
      }
      const [main, sub] = r[0].split("\n");
      r.forEach((c, i) => (i === 0 ? text(main, xs[i], y, 9, reg, INK, widths[i] - 10) : right(c, xs[i] + widths[i] - 8, y, 9, reg, INK)));
      if (sub) {
        y -= 10;
        text(sub, xs[0], y, 7.5, reg, FAINT, widths[0] - 10);
      }
      y -= 15;
    }
    y -= 14;
  };

  const win = (a: { starts_at: string | null; ends_at: string | null }) => {
    const f = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/Chicago" }) : null);
    return `${f(a.starts_at) ?? "Started"} - ${f(a.ends_at) ?? "ongoing"}`;
  };
  table(
    "Your ads",
    ["Ad", "Views", "Unique", "Clicks", "CTR"],
    [232, 70, 70, 70, 70],
    rep.ads.map((a) => [`${a.headline || "Ad"}\n${placementLabel(a.placement)} · ${win(a)}`, num(a.impressions), num(a.unique_viewers), num(a.clicks), ctr(a.clicks, a.impressions)]),
    "No ads have run yet.",
  );
  table(
    "Where your ads appeared",
    ["Placement", "Views", "Clicks", "CTR"],
    [302, 80, 80, 70],
    rep.placements.map((p) => [placementLabel(p.placement), num(p.impressions), num(p.clicks), ctr(p.clicks, p.impressions)]),
    "No placement data yet.",
  );
  table(
    "Matchups you presented",
    ["Matchup", "Votes", "Shares", "Graphics"],
    [302, 80, 80, 70],
    rep.bouts.slice(0, 15).map((b) => [`${b.competitor_a_name} vs ${b.competitor_b_name}`, num(b.votes), num(b.shares), num(b.graphics)]),
    "No matchups are linked to this sponsor yet.",
  );

  ensure(50);
  const note = "Counts come from BoutCasts records. Bots and crawlers are excluded. A view is one ad shown on screen; unique viewers counts distinct visits. Shares count taps on Share; the person may cancel before posting.";
  const words = note.split(" ");
  let line = "";
  for (const w of words) {
    if (reg.widthOfTextAtSize(`${line} ${w}`, 7.5) > W - 2 * M) {
      text(line, M, y, 7.5, reg, FAINT);
      y -= 10;
      line = w;
    } else line = line ? `${line} ${w}` : w;
  }
  if (line) text(line, M, y, 7.5, reg, FAINT);
  footer();

  const bytes = await doc.save();
  const slug = rep.sponsor.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "advertiser";
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="boutcasts-${slug}-results.pdf"`,
      "cache-control": "no-store",
    },
  });
}
