// Shrinks large photos in the browser before upload. Phone photos are often
// 4000px+ and 5–10 MB; voters only ever see them at screen size, so we cap
// the long edge and re-encode. Keeps transparency for PNG/WebP (logos).

const MAX_EDGE = 1600;
const SKIP_BELOW_BYTES = 600 * 1024; // already small enough — leave untouched
const JPEG_QUALITY = 0.85;

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      // Decoding off the main thread where the browser supports it.
      const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch {
      // fall through to <img>
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downscaleImage(file: File): Promise<File> {
  const type = file.type;
  const isRaster = type === "image/jpeg" || type === "image/png" || type === "image/webp";
  if (!isRaster) return file;

  let decoded: Awaited<ReturnType<typeof decode>>;
  try {
    decoded = await decode(file);
  } catch {
    return file; // can't decode here — upload the original rather than fail
  }

  const { width, height } = decoded;
  const longEdge = Math.max(width, height);
  if (longEdge <= MAX_EDGE && file.size <= SKIP_BELOW_BYTES) {
    decoded.close?.();
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / longEdge);
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    decoded.close?.();
    return file;
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(decoded.source, 0, 0, w, h);
  decoded.close?.();

  // PNG/WebP may have transparency (logos) — keep it; photos go to JPEG.
  let blob: Blob | null;
  let outType: string;
  if (type === "image/jpeg") {
    blob = await canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
    outType = "image/jpeg";
  } else {
    blob = await canvasToBlob(canvas, "image/webp", JPEG_QUALITY);
    outType = "image/webp";
    if (!blob || blob.type !== "image/webp") {
      // Safari can't encode WebP — fall back to PNG.
      blob = await canvasToBlob(canvas, "image/png");
      outType = "image/png";
    }
  }

  // Only use the result if it actually saved space.
  if (!blob || blob.size >= file.size) return file;

  const ext = outType === "image/jpeg" ? "jpg" : outType === "image/webp" ? "webp" : "png";
  const base = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${base}.${ext}`, { type: outType, lastModified: Date.now() });
}
