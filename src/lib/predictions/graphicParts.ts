// Shared pieces for the Predictions graphics (winners + crowd picks): background,
// the centered BoutCasts logo header and the footer, so both look like one family.

export type GraphicBrand = { name?: string | null; logo?: string | null; whiteLabel?: boolean };

export const GW = 1080;
export const GH = 1350;

export function loadImg(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = () => resolve(null);
    i.src = src;
  });
}

/** Paints the background and the header. Returns where content can start and whether the page is white-labeled. */
export async function drawHeader(
  c: CanvasRenderingContext2D,
  o: { heading: string; brand?: GraphicBrand | null },
): Promise<{ white: boolean; y: number }> {
  const W = GW, H = GH;
  const g = c.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, "#0b1a4a");
  g.addColorStop(1, "#1b4fe4");
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  c.fillStyle = "rgba(255,255,255,.06)";
  c.beginPath(); c.moveTo(0, H * 0.72); c.lineTo(W, H * 0.55); c.lineTo(W, H); c.lineTo(0, H); c.fill();

  c.textAlign = "center";
  const white = !!o.brand?.whiteLabel && !!(o.brand?.logo || o.brand?.name);
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
  c.fillText(o.heading, W / 2, cardY + cardH + 62);
  const hosted = !white && !!o.brand?.name;
  if (hosted) {
    c.fillStyle = "rgba(255,255,255,.85)"; c.font = "600 30px system-ui, sans-serif";
    c.fillText(`Hosted by ${o.brand?.name}`, W / 2, cardY + cardH + 106);
  }
  return { white, y: hosted ? 300 : 250 };
}

export function drawFooter(c: CanvasRenderingContext2D, o: { white: boolean; brand?: GraphicBrand | null; presenter?: string | null }) {
  c.textAlign = "center";
  if (o.presenter) {
    c.fillStyle = "#ffd36b"; c.font = "800 34px system-ui, sans-serif";
    c.fillText(`Presented by ${o.presenter}`, GW / 2, GH - 125);
  }
  c.fillStyle = "rgba(255,255,255,.85)"; c.font = "700 36px system-ui, sans-serif";
  c.fillText(o.white ? o.brand?.name || "" : "Make your picks at boutcasts.com/predictions", GW / 2, GH - 70);
}
