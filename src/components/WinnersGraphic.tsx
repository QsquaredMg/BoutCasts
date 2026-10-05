"use client";

import { useEffect, useRef, useState } from "react";

export type Winner = { name: string; points: number; detail?: string };

function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = src;
  });
}

export type GraphicBrand = { name?: string | null; logo?: string | null; whiteLabel?: boolean };

type DrawOpts = {
  title: string; subtitle: string; winners: Winner[];
  homeLogo?: string | null; awayLogo?: string | null;
  brand?: GraphicBrand | null; presenter?: string | null;
};

async function draw(canvas: HTMLCanvasElement, o: DrawOpts) {
  const W = 1080, H = 1350;
  canvas.width = W;
  canvas.height = H;
  const c = canvas.getContext("2d");
  if (!c) return;
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0b1a4a");
  g.addColorStop(1, "#1b4fe4");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.fillStyle = "rgba(255,255,255,.06)";
  c.beginPath(); c.moveTo(0, H * 0.72); c.lineTo(W, H * 0.55); c.lineTo(W, H); c.lineTo(0, H); c.fill();

  c.textAlign = "center";
  const white = !!o.brand?.whiteLabel && !!(o.brand?.logo || o.brand?.name);
  // Header: centered logo on a white card, "Predictions - Winners" beneath it.
  const mark = await loadImg(white && o.brand?.logo ? o.brand.logo : "/boutcasts-wordmark.png");
  const cardW = 460, cardH = 128, cardX = (W - cardW) / 2, cardY = 36;
  c.fillStyle = "#fff";
  c.beginPath(); c.roundRect(cardX, cardY, cardW, cardH, 30); c.fill();
  if (mark) {
    const r = Math.min((cardW - 40) / mark.width, (cardH - 24) / mark.height);
    c.drawImage(mark, cardX + (cardW - mark.width * r) / 2, cardY + (cardH - mark.height * r) / 2, mark.width * r, mark.height * r);
  } else {
    c.fillStyle = "#0b1a4a"; c.font = "900 52px system-ui, sans-serif";
    c.fillText(white ? o.brand?.name || "" : "BoutCasts", W / 2, cardY + 82);
  }
  c.fillStyle = "#ffd36b";
  c.font = "800 44px system-ui, sans-serif";
  c.fillText("Predictions - Winners", W / 2, cardY + cardH + 62);
  if (!white && o.brand?.name) {
    c.fillStyle = "rgba(255,255,255,.85)"; c.font = "600 30px system-ui, sans-serif";
    c.fillText(`Hosted by ${o.brand.name}`, W / 2, cardY + cardH + 106);
  }

  const logos = await Promise.all([o.homeLogo ? loadImg(o.homeLogo) : null, o.awayLogo ? loadImg(o.awayLogo) : null]);
  let y = !white && o.brand?.name ? 300 : 250;
  if (logos[0] || logos[1]) {
    const s = 150;
    const pos = [W / 2 - 150 - s, W / 2 + 150];
    logos.forEach((img, i) => {
      if (!img) return;
      c.fillStyle = "#fff";
      c.beginPath(); c.roundRect(pos[i], y, s, s, 28); c.fill();
      const r = Math.min((s - 20) / img.width, (s - 20) / img.height);
      c.drawImage(img, pos[i] + (s - img.width * r) / 2, y + (s - img.height * r) / 2, img.width * r, img.height * r);
    });
    c.fillStyle = "#fff"; c.font = "900 56px system-ui, sans-serif"; c.fillText("VS", W / 2, y + 95);
    y += s + 40;
  }

  c.fillStyle = "#fff";
  let size = 64;
  c.font = `900 ${size}px system-ui, sans-serif`;
  while (c.measureText(o.title).width > W - 120 && size > 30) { size -= 2; c.font = `900 ${size}px system-ui, sans-serif`; }
  c.fillText(o.title, W / 2, y + 60);
  c.fillStyle = "rgba(255,255,255,.8)";
  c.font = "600 36px system-ui, sans-serif";
  c.fillText(o.subtitle, W / 2, y + 115);
  y += 190;

  const medals = ["🥇", "🥈", "🥉"];
  const rows = o.winners.slice(0, 3);
  if (rows.length === 0) {
    c.fillStyle = "#fff"; c.font = "700 44px system-ui, sans-serif"; c.fillText("No predictions this time", W / 2, y + 100);
  }
  rows.forEach((w, i) => {
    const top = y + i * 190;
    c.fillStyle = i === 0 ? "rgba(255,211,107,.22)" : "rgba(255,255,255,.12)";
    c.beginPath(); c.roundRect(70, top, W - 140, 160, 32); c.fill();
    c.textAlign = "left";
    c.font = "88px system-ui, sans-serif"; c.fillStyle = "#fff"; c.fillText(medals[i], 105, top + 108);
    let ns = 60;
    c.font = `900 ${ns}px system-ui, sans-serif`;
    while (c.measureText(w.name).width > 560 && ns > 28) { ns -= 2; c.font = `900 ${ns}px system-ui, sans-serif`; }
    c.fillStyle = "#fff"; c.fillText(w.name, 235, top + (w.detail ? 78 : 100));
    if (w.detail) { c.font = "600 32px system-ui, sans-serif"; c.fillStyle = "rgba(255,255,255,.75)"; c.fillText(w.detail, 235, top + 125); }
    c.textAlign = "right";
    c.fillStyle = "#ffd36b"; c.font = "900 72px system-ui, sans-serif"; c.fillText(String(w.points), W - 130, top + 98);
    c.font = "700 28px system-ui, sans-serif"; c.fillText("PTS", W - 100, top + 135);
  });
  c.textAlign = "center";
  if (o.presenter) {
    c.fillStyle = "#ffd36b"; c.font = "800 34px system-ui, sans-serif";
    c.fillText(`Presented by ${o.presenter}`, W / 2, H - 125);
  }
  c.fillStyle = "rgba(255,255,255,.85)"; c.font = "700 36px system-ui, sans-serif";
  c.fillText(white ? o.brand?.name || "" : "Make your picks at boutcasts.com/predictions", W / 2, H - 70);
}

export default function WinnersGraphic({
  title, subtitle, winners, homeLogo, awayLogo, brand, presenter, fileName = "bout-predictions-winners",
}: { title: string; subtitle: string; winners: Winner[]; homeLogo?: string | null; awayLogo?: string | null; brand?: GraphicBrand | null; presenter?: string | null; fileName?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [canShare, setCanShare] = useState(false);
  const key = JSON.stringify([title, subtitle, winners, homeLogo, awayLogo, brand, presenter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function" && typeof navigator.canShare === "function");
    if (ref.current) draw(ref.current, { title, subtitle, winners, homeLogo, awayLogo, brand, presenter });
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
      <h2 className="mb-3 text-lg font-bold" style={{ fontFamily: "var(--font-display)" }}>Winners graphic</h2>
      <canvas ref={ref} className="mx-auto mb-3 w-full max-w-sm rounded-xl" style={{ aspectRatio: "1080 / 1350" }} aria-label={`Winners: ${winners.map((w) => w.name).join(", ")}`} />
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={download} className="bc-btn-solid rounded-full px-4 py-2.5 text-sm font-bold">Download</button>
        {canShare ? (
          <button type="button" onClick={share} className="rounded-full border px-4 py-2.5 text-sm font-semibold" style={{ borderColor: "var(--border)" }}>Share…</button>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
