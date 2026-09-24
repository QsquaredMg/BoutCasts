"use client";

import { useEffect, useRef, useState } from "react";

type RecapBoutFrame = {
  id: string;
  aName: string;
  bName: string;
  pctA: number;
  pctB: number;
  winnerSide: "a" | "b" | null;
};

const PER_BOUT_MS = 4000;
const FADE_MS = 300;
const REVEAL_AT_MS = 2200;
const WIDTH = 960;
const HEIGHT = 540;

const COLOR_BG = "#f6f4ef";
const COLOR_SURFACE = "#ffffff";
const COLOR_SURFACE2 = "#efece3";
const COLOR_TEXT = "#141413";
const COLOR_TEXT_FAINT = "#8a867a";
const COLOR_RED = "#d92c4c";
const COLOR_BLUE = "#1f5fd6";
const COLOR_GOLD = "#a97a12";
const COLOR_GOLD_SOFT = "#f4e6c8";

function clamp01(x: number) {
  return Math.max(0, Math.min(1, x));
}

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function drawFrame(
  ctx: CanvasRenderingContext2D,
  bout: RecapBoutFrame,
  localT: number,
  meta: { categoryName: string; levelLabel: string; sponsorName?: string | null },
  logoImg?: HTMLImageElement | null
) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = COLOR_BG;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const introT = easeOut(clamp01(localT / 500));

  // Top row: logo + category tag
  ctx.textBaseline = "middle";
  if (logoImg && logoImg.naturalWidth > 0) {
    const logoH = 48;
    const logoW = logoH * (logoImg.naturalWidth / logoImg.naturalHeight);
    ctx.drawImage(logoImg, 40, 32, logoW, logoH);
  } else {
    ctx.font = "bold 28px Georgia, serif";
    ctx.fillStyle = COLOR_TEXT;
    ctx.fillText("Bout", 40, 56);
    const boutWidth = ctx.measureText("Bout").width;
    ctx.fillStyle = COLOR_RED;
    ctx.fillText("Casts", 40 + boutWidth, 56);
  }

  ctx.font = "bold 14px system-ui, sans-serif";
  ctx.fillStyle = COLOR_TEXT_FAINT;
  const catLabel = meta.categoryName.toUpperCase();
  const catWidth = ctx.measureText(catLabel).width;
  roundRect(ctx, WIDTH - 40 - catWidth - 24, 38, catWidth + 24, 28, 14);
  ctx.fillStyle = COLOR_SURFACE2;
  ctx.fill();
  ctx.fillStyle = COLOR_TEXT_FAINT;
  ctx.fillText(catLabel, WIDTH - 40 - catWidth - 12, 52);

  ctx.font = "13px system-ui, sans-serif";
  ctx.fillStyle = COLOR_TEXT_FAINT;
  ctx.fillText(meta.levelLabel, 40, 90);

  // VS panels
  const panelY = 130;
  const panelH = 300;
  const panelW = 360;
  const gap = 40;
  const totalW = panelW * 2 + gap;
  const startX = (WIDTH - totalW) / 2;

  ctx.globalAlpha = introT;

  const revealT = clamp01((localT - REVEAL_AT_MS) / 500);
  const winnerKnown = bout.winnerSide !== null && revealT > 0;

  function panel(side: "a" | "b", x: number, name: string, pct: number) {
    const isWinner = winnerKnown && bout.winnerSide === side;
    const isLoser = winnerKnown && bout.winnerSide !== null && bout.winnerSide !== side;
    const color = side === "a" ? COLOR_RED : COLOR_BLUE;

    ctx.save();
    if (isLoser) ctx.globalAlpha *= 0.55;

    roundRect(ctx, x, panelY, panelW, panelH, 20);
    ctx.fillStyle = isWinner ? COLOR_GOLD_SOFT : COLOR_SURFACE;
    ctx.fill();

    // avatar circle
    const cx = x + panelW / 2;
    const avatarY = panelY + 90;
    const scale = isWinner ? 1 + 0.15 * easeOut(revealT) : 1;
    ctx.save();
    ctx.translate(cx, avatarY);
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.arc(0, 0, 46, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 28px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(initials(name), 0, 4);
    ctx.textAlign = "left";
    ctx.restore();

    // winner tag
    if (isWinner) {
      ctx.globalAlpha *= easeOut(revealT);
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.fillStyle = COLOR_GOLD;
      ctx.textAlign = "center";
      ctx.fillText("🏆 WINNER", cx, panelY + 30);
      ctx.textAlign = "left";
      ctx.globalAlpha = 1;
      if (isLoser) ctx.globalAlpha *= 0.55;
    }

    // name
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillStyle = COLOR_TEXT;
    ctx.textAlign = "center";
    ctx.fillText(name, cx, panelY + 175);

    // pct chip
    const pctLabel = `${pct}%`;
    ctx.font = "bold 16px system-ui, sans-serif";
    const pctW = ctx.measureText(pctLabel).width;
    roundRect(ctx, cx - pctW / 2 - 14, panelY + 200, pctW + 28, 32, 16);
    ctx.fillStyle = COLOR_SURFACE2;
    ctx.fill();
    ctx.fillStyle = color;
    ctx.fillText(pctLabel, cx - pctW / 2, panelY + 220);
    ctx.textAlign = "left";

    // vote bar
    const barY = panelY + panelH - 34;
    const barW = panelW - 80;
    const barX = x + 40;
    roundRect(ctx, barX, barY, barW, 8, 4);
    ctx.fillStyle = COLOR_SURFACE2;
    ctx.fill();
    roundRect(ctx, barX, barY, barW * (pct / 100), 8, 4);
    ctx.fillStyle = color;
    ctx.fill();

    ctx.restore();
  }

  panel("a", startX, bout.aName, bout.pctA);
  panel("b", startX + panelW + gap, bout.bName, bout.pctB);

  // VS divider
  ctx.font = "bold 20px system-ui, sans-serif";
  ctx.fillStyle = COLOR_TEXT_FAINT;
  ctx.textAlign = "center";
  ctx.fillText("VS", WIDTH / 2, panelY + panelH / 2);
  ctx.textAlign = "left";

  ctx.globalAlpha = 1;

  // sponsor strip
  if (meta.sponsorName) {
    roundRect(ctx, startX, panelY + panelH + 20, totalW, 40, 10);
    ctx.fillStyle = COLOR_SURFACE2;
    ctx.fill();
    ctx.font = "bold 14px system-ui, sans-serif";
    ctx.fillStyle = COLOR_TEXT;
    ctx.textAlign = "center";
    ctx.fillText(`🏆 Presented by ${meta.sponsorName}`, WIDTH / 2, panelY + panelH + 41);
    ctx.textAlign = "left";
  }
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, "0")}`;
}

export default function RecapVideoPlayer({
  bouts,
  categoryName,
  levelLabel,
  sponsorName,
}: {
  bouts: RecapBoutFrame[];
  categoryName: string;
  levelLabel: string;
  sponsorName?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const logoImgRef = useRef<HTMLImageElement | null>(null);
  const [logoReady, setLogoReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [exportSupported, setExportSupported] = useState(true);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const total = bouts.length * PER_BOUT_MS;

  useEffect(() => {
    setExportSupported(
      typeof window !== "undefined" &&
        !!HTMLCanvasElement.prototype.captureStream &&
        typeof MediaRecorder !== "undefined"
    );
  }, []);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      logoImgRef.current = img;
      setLogoReady(true);
    };
    img.src = "/boutcasts-logo.png";
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;
    // draw an initial static frame (round 1 hold state) when idle
    if (!playing && bouts.length > 0) {
      drawFrame(ctx, bouts[0], REVEAL_AT_MS + 600, { categoryName, levelLabel, sponsorName }, logoImgRef.current);
    }
  }, [playing, bouts, categoryName, levelLabel, sponsorName, logoReady]);

  function stopLoop() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }

  function tick() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx) return;

    const now = performance.now();
    const t = now - startRef.current;
    setElapsed(Math.min(t, total));

    if (t >= total) {
      setPlaying(false);
      stopLoop();
      if (recording) finishRecording();
      return;
    }

    const idx = Math.min(bouts.length - 1, Math.floor(t / PER_BOUT_MS));
    const localT = t - idx * PER_BOUT_MS;
    const bout = bouts[idx];

    drawFrame(ctx, bout, localT, { categoryName, levelLabel, sponsorName }, logoImgRef.current);

    // fade to black at the very start/end of each segment for a clean cut
    const distFromEdge = Math.min(localT, PER_BOUT_MS - localT);
    if (distFromEdge < FADE_MS && idx > 0) {
      const alpha = 1 - distFromEdge / FADE_MS;
      ctx.fillStyle = `rgba(246,244,239,${alpha})`;
      ctx.fillRect(0, 0, WIDTH, HEIGHT);
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  function play() {
    if (bouts.length === 0) return;
    setPlaying(true);
    startRef.current = performance.now();
    stopLoop();
    rafRef.current = requestAnimationFrame(tick);
  }

  function finishRecording() {
    recorderRef.current?.stop();
  }

  function startDownload() {
    const canvas = canvasRef.current;
    if (!canvas || !exportSupported) return;
    setDownloadUrl(null);
    chunksRef.current = [];

    const stream = canvas.captureStream(30);
    const recorder = new MediaRecorder(stream, {
      mimeType: "video/webm;codecs=vp9",
    });
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "video/webm" });
      setDownloadUrl(URL.createObjectURL(blob));
      setRecording(false);
    };
    recorderRef.current = recorder;
    recorder.start();
    setRecording(true);
    play();
  }

  const pct = total > 0 ? clamp01(elapsed / total) : 0;

  return (
    <div className="bc-card overflow-hidden">
      <div className="relative" style={{ background: COLOR_BG }}>
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="block w-full cursor-pointer"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
          onClick={() => (playing ? undefined : play())}
        />
        {!playing && (
          <button
            type="button"
            onClick={play}
            className="absolute inset-0 flex items-center justify-center"
            aria-label="Play recap"
          >
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ background: "rgba(20,20,19,0.65)" }}
            >
              <svg viewBox="0 0 24 24" width="26" height="26" fill="#fff">
                <path d="M6 4l14 8-14 8V4z" />
              </svg>
            </span>
          </button>
        )}
        <div
          className="absolute bottom-0 left-0 right-0 h-1"
          style={{ background: "rgba(0,0,0,0.1)" }}
        >
          <div className="h-full" style={{ width: `${pct * 100}%`, background: COLOR_RED }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span className="text-xs tabular-nums" style={{ color: "var(--text-faint)" }}>
          {formatTime(elapsed)} / {formatTime(total)} · {bouts.length} bout{bouts.length === 1 ? "" : "s"}
        </span>

        {exportSupported ? (
          downloadUrl ? (
            <a
              href={downloadUrl}
              download={`boutcasts-${levelLabel.toLowerCase().replace(/\s+/g, "-")}-recap.webm`}
              className="rounded-full px-4 py-1.5 text-xs font-bold text-white"
              style={{ background: "var(--blue)" }}
            >
              ⬇ Download recap video
            </a>
          ) : (
            <button
              type="button"
              onClick={startDownload}
              disabled={recording}
              className="rounded-full border px-4 py-1.5 text-xs font-bold disabled:opacity-50"
              style={{ borderColor: "var(--border)", color: "var(--text-dim)" }}
            >
              {recording ? "Recording…" : "🎬 Generate recap video"}
            </button>
          )
        ) : (
          <span className="text-xs" style={{ color: "var(--text-faint)" }}>
            Video export isn&apos;t supported in this browser — try Chrome or Edge.
          </span>
        )}
      </div>
    </div>
  );
}
