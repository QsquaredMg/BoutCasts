"use client";

import { useEffect, useRef, useState } from "react";
import { drawFooter, drawHeader, loadImg, GW, GH, type GraphicBrand } from "@/lib/predictions/graphicParts";
import { crowdView, type CrowdStats } from "@/lib/predictions/crowd";

type Opts = {
  stats: CrowdStats; home: string; away: string; homeLogo?: string | null; awayLogo?: string | null;
  brand?: GraphicBrand | null; presenter?: string | null;
};

function fit(c: CanvasRenderingContext2D, text: string, max: number, size: number, weight = 800) {
  let s = size;
  c.font = `${weight} ${s}px system-ui, sans-serif`;
  while (c.measureText(text).width > max && s > 20) { s -= 2; c.font = `${weight} ${s}px system-ui, sans-serif`; }
}

async function draw(canvas: HTMLCanvasElement, o: Opts) {
  const v = crowdView(o.stats, o.home, o.away);
  const W = GW, H = GH;
  canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d");
  if (!c || !v) return;
  const { white, y: y0 } = await drawHeader(c, { heading: "Predictions - Crowd Picks", brand: o.brand });
  const [hl, al] = await Promise.all([o.homeLogo ? loadImg(o.homeLogo) : null, o.awayLogo ? loadImg(o.awayLogo) : null]);

  // Teams
  const s = 150;
  ([[270, hl, o.home], [810, al, o.away]] as const).forEach(([cx, img, name]) => {
    c.fillStyle = "#fff"; c.beginPath(); c.roundRect(cx - s / 2, y0, s, s, 28); c.fill();
    if (img) {
      const r = Math.min((s - 20) / img.width, (s - 20) / img.height);
      c.drawImage(img, cx - (img.width * r) / 2, y0 + (s - img.height * r) / 2, img.width * r, img.height * r);
    } else {
      c.fillStyle = "#0b1a4a"; c.font = "900 72px system-ui, sans-serif"; c.textAlign = "center";
      c.fillText((name[0] ?? "?").toUpperCase(), cx, y0 + 98);
    }
    c.textAlign = "center"; c.fillStyle = "#fff"; fit(c, name, 440, 40, 800);
    c.fillText(name, cx, y0 + s + 48);
  });
  c.textAlign = "center"; c.fillStyle = "#fff"; c.font = "900 52px system-ui, sans-serif"; c.fillText("VS", W / 2, y0 + 95);

  // Headline
  c.fillStyle = "rgba(255,255,255,.8)"; c.font = "600 34px system-ui, sans-serif";
  c.fillText(`Out of ${v.n} predictions`, W / 2, y0 + 272);
  c.fillStyle = "#ffd36b"; c.font = "900 150px system-ui, sans-serif";
  if (v.leader) {
    c.fillText(`${v.leaderPct}%`, W / 2, y0 + 410);
    c.fillStyle = "#fff"; fit(c, `picked ${v.leader === "home" ? o.home : o.away} to win`, W - 120, 46, 800);
    c.fillText(`picked ${v.leader === "home" ? o.home : o.away} to win`, W / 2, y0 + 468);
  } else {
    c.fillText(`${v.homePct} / ${v.awayPct}`, W / 2, y0 + 410);
    c.fillStyle = "#fff"; c.font = "800 46px system-ui, sans-serif";
    c.fillText("The crowd is split", W / 2, y0 + 468);
  }

  // Split bar
  const bx = 90, bw = W - 180, by = y0 + 500, bh = 54;
  c.save();
  c.beginPath(); c.roundRect(bx, by, bw, bh, 27); c.clip();
  const hw = (bw * v.homePct) / 100, dw = (bw * v.drawPct) / 100;
  c.fillStyle = "#ffd36b"; c.fillRect(bx, by, hw, bh);
  c.fillStyle = "rgba(255,255,255,.45)"; c.fillRect(bx + hw, by, dw, bh);
  c.fillStyle = "#ffffff"; c.fillRect(bx + hw + dw, by, bw - hw - dw, bh);
  c.restore();
  c.font = "800 32px system-ui, sans-serif";
  c.textAlign = "left"; c.fillStyle = "#ffd36b"; c.fillText(`${o.home} ${v.homePct}%`, bx, by + bh + 46);
  c.textAlign = "right"; c.fillStyle = "#fff"; c.fillText(`${o.away} ${v.awayPct}%`, bx + bw, by + bh + 46);
  if (v.drawPct > 0) { c.textAlign = "center"; c.fillStyle = "rgba(255,255,255,.8)"; c.fillText(`Draw ${v.drawPct}%`, W / 2, by + bh + 46); }

  // Stat cards
  const cy = y0 + 625, ch = 150, cw = 435;
  ([[90, "AVG PREDICTED SCORE", v.avgText], [W - 90 - cw, "CROWD SPREAD", v.spreadText]] as const).forEach(([x, k, val]) => {
    c.fillStyle = "rgba(255,255,255,.13)"; c.beginPath(); c.roundRect(x, cy, cw, ch, 28); c.fill();
    c.textAlign = "center"; c.fillStyle = "rgba(255,255,255,.75)"; c.font = "700 26px system-ui, sans-serif";
    c.fillText(k, x + cw / 2, cy + 44);
    c.fillStyle = "#fff"; fit(c, val, cw - 40, 60, 900);
    c.fillText(val, x + cw / 2, cy + 112);
  });

  // Most common pick + mood
  const py = y0 + 795;
  c.fillStyle = "rgba(255,211,107,.2)"; c.beginPath(); c.roundRect(90, py, W - 180, 76, 38); c.fill();
  c.textAlign = "center"; c.fillStyle = "#fff";
  const top = v.topText ? `Most common pick ${v.topText}  ·  ` : "";
  const line = `${top}Crowd mood: ${v.confidence}`;
  fit(c, line, W - 240, 34, 800);
  c.fillText(line, W / 2, py + 50);

  drawFooter(c, { white, brand: o.brand, presenter: o.presenter });
}

export default function CrowdGraphic({ stats, home, away, homeLogo, awayLogo, brand, presenter, title }: Opts & { title: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [canShare, setCanShare] = useState(false);
  const key = JSON.stringify([stats, home, away, homeLogo, awayLogo, brand, presenter]);
  const fileName = `crowd-picks-${title}`.toLowerCase().replace(/[^a-z0-9]+/g, "-");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function");
    if (ref.current) draw(ref.current, { stats, home, away, homeLogo, awayLogo, brand, presenter });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function download() {
    const a = document.createElement("a");
    a.href = ref.current!.toDataURL("image/png");
    a.download = `${fileName}.png`;
    a.click();
  }
  function share() {
    ref.current!.toBlob(async (b) => {
      if (!b) return;
      const file = new File([b], `${fileName}.png`, { type: "image/png" });
      try {
        if (navigator.canShare({ files: [file] })) await navigator.share({ files: [file], title });
      } catch {
        // cancelled
      }
    });
  }

  return (
    <div className="bc-card p-4">
      <h2 className="mb-3 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Predictions graphic</h2>
      <canvas ref={ref} className="mx-auto mb-3 w-full max-w-sm rounded-xl" style={{ aspectRatio: "1080 / 1350" }} aria-label={`Crowd predictions for ${title}`} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={download} className="bc-btn-solid rounded-full px-4 py-2.5 text-sm font-bold">Download</button>
        {canShare ? (
          <button type="button" onClick={share} className="rounded-full border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>Share…</button>
        ) : <span />}
      </div>
    </div>
  );
}
