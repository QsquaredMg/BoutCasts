import QRCode from "qrcode";

// Branded QR codes for Live Votes. The code is drawn on a canvas in the event's
// own color with the organizer's logo in the middle, so a school's QR looks
// like the school's. Error correction is set to "H" (about 30% of the code can
// be covered) and the logo only covers about 5%, so it still scans reliably.
// Browser only: it needs a canvas.

export type QrBrand = {
  /** Event brand color, e.g. "#7a1f3d". Too-light colors are darkened so the code stays scannable. */
  color?: string | null;
  /** Logo shown in the middle of the code. */
  logoUrl?: string | null;
  /** School or organization name. Used for the monogram fallback and the poster header. */
  name?: string | null;
};

const FALLBACK_INK = "#0A0E1A";

function parseHex(hex: string | null | undefined): [number, number, number] | null {
  if (!hex) return null;
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function toHex([r, g, b]: [number, number, number]) {
  return "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
}

function luminance([r, g, b]: [number, number, number]) {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Contrast ratio against white. */
function contrastOnWhite(rgb: [number, number, number]) {
  return 1.05 / (luminance(rgb) + 0.05);
}

/** The brand color, darkened as needed to keep a strong contrast with the white background. */
export function qrInk(color: string | null | undefined): string {
  let rgb = parseHex(color);
  if (!rgb) return FALLBACK_INK;
  for (let i = 0; i < 20 && contrastOnWhite(rgb) < 4.5; i++) {
    rgb = [rgb[0] * 0.9, rgb[1] * 0.9, rgb[2] * 0.9];
  }
  return toHex(rgb);
}

/** Black or white, whichever reads best on the given background. */
export function readableOn(color: string | null | undefined): string {
  const rgb = parseHex(color);
  if (!rgb) return "#ffffff";
  return luminance(rgb) > 0.4 ? "#0A0E1A" : "#ffffff";
}

function initials(name: string | null | undefined) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const a = words[0][0] ?? "";
  const b = words.length > 1 ? (words[1][0] ?? "") : (words[0][1] ?? "");
  return (a + b).toUpperCase();
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/** Draws the QR code onto `ctx` inside the square starting at (x, y) with side `size`. */
async function paintQr(ctx: CanvasRenderingContext2D, url: string, x: number, y: number, size: number, brand?: QrBrand) {
  const ink = qrInk(brand?.color);
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size;
  const quiet = 4;
  const cell = size / (n + quiet * 2);
  const ox = x + quiet * cell;
  const oy = y + quiet * cell;

  // white card behind the code, including the quiet zone
  ctx.fillStyle = "#ffffff";
  roundRectPath(ctx, x, y, size, size, cell * 2.5);
  ctx.fill();

  // clear zone for the logo (about 5% of the code's area)
  const logoModules = Math.max(7, Math.round(n * 0.18) | 1);
  const lo = Math.floor((n - logoModules) / 2);
  const inLogo = (r: number, c: number) => r >= lo && r < lo + logoModules && c >= lo && c < lo + logoModules;
  const inFinder = (r: number, c: number) => (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);

  ctx.fillStyle = ink;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!qr.modules.get(r, c) || inFinder(r, c) || inLogo(r, c)) continue;
      // slightly rounded, with a hair of overlap so neighbors read as one shape
      roundRectPath(ctx, ox + c * cell - 0.3, oy + r * cell - 0.3, cell + 0.6, cell + 0.6, cell * 0.3);
      ctx.fill();
    }
  }

  // the three corner "eyes": a rounded ring around a rounded block
  const eyes: Array<[number, number]> = [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ];
  for (const [r, c] of eyes) {
    const ex = ox + c * cell;
    const ey = oy + r * cell;
    ctx.fillStyle = ink;
    roundRectPath(ctx, ex, ey, cell * 7, cell * 7, cell * 2);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    roundRectPath(ctx, ex + cell, ey + cell, cell * 5, cell * 5, cell * 1.4);
    ctx.fill();
    ctx.fillStyle = ink;
    roundRectPath(ctx, ex + cell * 2, ey + cell * 2, cell * 3, cell * 3, cell * 0.9);
    ctx.fill();
  }

  // logo (or a monogram in the brand color) in the middle
  const box = logoModules * cell;
  const bx = ox + lo * cell;
  const by = oy + lo * cell;
  ctx.fillStyle = "#ffffff";
  roundRectPath(ctx, bx, by, box, box, box * 0.22);
  ctx.fill();
  const pad = box * 0.1;
  const img = brand?.logoUrl ? await loadImage(brand.logoUrl) : null;
  if (img && img.width && img.height) {
    const inner = box - pad * 2;
    const scale = Math.min(inner / img.width, inner / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.save();
    roundRectPath(ctx, bx + pad, by + pad, inner, inner, inner * 0.18);
    ctx.clip();
    ctx.drawImage(img, bx + (box - w) / 2, by + (box - h) / 2, w, h);
    ctx.restore();
  } else {
    const text = initials(brand?.name);
    if (text) {
      // brand-colored initials on the white tile (no big dark block, which scanners dislike)
      ctx.strokeStyle = ink;
      ctx.lineWidth = box * 0.06;
      roundRectPath(ctx, bx + pad, by + pad, box - pad * 2, box - pad * 2, box * 0.18);
      ctx.stroke();
      ctx.fillStyle = ink;
      ctx.font = `800 ${box * 0.38}px system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text, bx + box / 2, by + box / 2 + box * 0.02);
    }
  }
}

/** A square PNG data URL of the branded QR code. */
export async function renderBrandedQr(url: string, brand?: QrBrand, size = 1024): Promise<string> {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available in this browser.");
  // solid white behind everything so the PNG never has see-through corners
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, size, size);
  await paintQr(ctx, url, 0, 0, size, brand);
  return canvas.toDataURL("image/png");
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = kept[maxLines - 1].replace(/\s*\S*$/, "") + "…";
    return kept;
  }
  return lines;
}

/**
 * A print-ready poster (letter proportions) for hallways, programs and slides:
 * the school's name in its color, the vote's title, the branded QR code and the link.
 */
export async function renderQrPoster(opts: {
  url: string;
  title: string;
  brand?: QrBrand;
  callToAction?: string;
  code?: string | null;
  /** Hide the "Powered by BoutCasts" line for white-label events. */
  whiteLabel?: boolean;
}): Promise<string> {
  const W = 1700;
  const H = 2200;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas isn't available in this browser.");
  const font = (weight: number, px: number) => `${weight} ${px}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;

  const ink = qrInk(opts.brand?.color);
  const onInk = readableOn(ink);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // header band in the school's color
  ctx.fillStyle = ink;
  ctx.fillRect(0, 0, W, 330);
  ctx.fillStyle = onInk;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = font(800, 92);
  const header = (opts.brand?.name ?? "").trim() || "Cast your vote";
  const headerLines = wrapLines(ctx, header, W - 200, 2);
  const lh = 104;
  headerLines.forEach((l, i) => ctx.fillText(l, W / 2, 165 - ((headerLines.length - 1) * lh) / 2 + i * lh));

  // title
  ctx.fillStyle = "#0A0E1A";
  ctx.font = font(800, 104);
  const titleLines = wrapLines(ctx, opts.title, W - 220, 3);
  const tlh = 120;
  const titleTop = 470;
  titleLines.forEach((l, i) => ctx.fillText(l, W / 2, titleTop + i * tlh));

  // call to action
  const ctaY = titleTop + titleLines.length * tlh + 40;
  ctx.fillStyle = ink;
  ctx.font = font(700, 66);
  ctx.fillText(opts.callToAction ?? "Scan to vote and see live results", W / 2, ctaY);

  // QR code
  const qrSize = 1060;
  const qrY = Math.max(ctaY + 70, 800);
  const qrX = (W - qrSize) / 2;
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 12;
  await paintQr(ctx, opts.url, qrX, qrY, qrSize, opts.brand);
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // link and optional private-event code
  let y = qrY + qrSize + 90;
  ctx.fillStyle = "#0A0E1A";
  const shownUrl = opts.url.replace(/^https?:\/\//, "");
  // long links shrink to fit the page instead of running off the edge
  let urlPx = 58;
  ctx.font = font(700, urlPx);
  while (urlPx > 28 && ctx.measureText(shownUrl).width > W - 160) {
    urlPx -= 2;
    ctx.font = font(700, urlPx);
  }
  ctx.fillText(shownUrl, W / 2, y);
  if (opts.code) {
    y += 100;
    ctx.fillStyle = "#4a5163";
    ctx.font = font(600, 46);
    ctx.fillText("or enter this code at boutcasts.com/join", W / 2, y);
    y += 96;
    ctx.fillStyle = ink;
    ctx.font = font(900, 92);
    ctx.fillText(opts.code.split("").join(" "), W / 2, y);
  }

  if (!opts.whiteLabel) {
    ctx.fillStyle = "#7a8296";
    ctx.font = font(600, 38);
    ctx.fillText("Voting powered by BoutCasts", W / 2, H - 70);
  }
  return canvas.toDataURL("image/png");
}
