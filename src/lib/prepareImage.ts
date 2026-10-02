import { downscaleImage } from "@/lib/downscaleImage";

// One place that turns any common photo into something every browser can show:
//   JPG / PNG / WebP  → kept (big ones shrunk)
//   GIF               → kept as-is (keeps animation)
//   HEIC / HEIF       → JPEG (iPhone photos; most browsers can't show HEIC)
//   AVIF / BMP / TIFF / SVG / other images → JPEG, or PNG/WebP when it may be transparent
// Every photo upload on the site runs through this before uploading.

/** For <input type="file" accept=…> on photo pickers. */
export const PHOTO_ACCEPT =
  "image/*,.jpg,.jpeg,.png,.webp,.gif,.heic,.heif,.avif,.bmp,.tif,.tiff,.svg";

/** Human-readable list for help text. */
export const PHOTO_FORMATS_LABEL = "JPG, PNG, HEIC (iPhone), WebP, GIF, AVIF, BMP, TIFF or SVG";

const WEB_SAFE = ["image/jpeg", "image/png", "image/webp"];

function ext(name: string) {
  return (name.split(".").pop() ?? "").toLowerCase();
}

/** True for anything that looks like a photo, even when the browser leaves the type blank. */
export function isPhotoFile(file: File) {
  return file.type.startsWith("image/") || ["heic", "heif", "avif", "bmp", "tif", "tiff", "svg", "jpg", "jpeg", "png", "webp", "gif"].includes(ext(file.name));
}

function isHeic(file: File) {
  return /image\/hei[cf]/i.test(file.type) || ["heic", "heif"].includes(ext(file.name));
}

function rename(file: File, newExt: string) {
  return `${file.name.replace(/\.[^.]+$/, "") || "photo"}.${newExt}`;
}

async function decodeToCanvas(file: Blob): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    // SVGs can report 0×0; give them a sensible size.
    const w = img.naturalWidth || 1200;
    const h = img.naturalHeight || 1200;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function decodeTiff(file: Blob): Promise<HTMLCanvasElement> {
  const UTIF = (await import("utif")).default;
  const buf = await file.arrayBuffer();
  const ifds = UTIF.decode(buf);
  if (!ifds.length) throw new Error("empty tiff");
  UTIF.decodeImage(buf, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const w = ifds[0].width as number;
  const h = ifds[0].height as number;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(w, h);
  img.data.set(rgba);
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

export class UnsupportedPhotoError extends Error {}

/**
 * Convert/shrink a picked photo for upload. Throws UnsupportedPhotoError with
 * a friendly message if this device can't read the file.
 */
export async function prepareImage(file: File): Promise<File> {
  if (!isPhotoFile(file)) throw new UnsupportedPhotoError(`That isn't a photo. Use ${PHOTO_FORMATS_LABEL}.`);

  // Already web-friendly.
  if (WEB_SAFE.includes(file.type)) return downscaleImage(file);
  if (file.type === "image/gif") return file;

  // iPhone HEIC/HEIF: Safari can often read it directly; everyone else needs the converter.
  if (isHeic(file)) {
    let jpeg: Blob | null = null;
    try {
      const canvas = await decodeToCanvas(file);
      jpeg = await toBlob(canvas, "image/jpeg", 0.9);
    } catch {
      try {
        const { default: heic2any } = await import("heic2any");
        const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.9 });
        jpeg = Array.isArray(out) ? out[0] : out;
      } catch {
        jpeg = null;
      }
    }
    if (!jpeg) throw new UnsupportedPhotoError("We couldn't read that iPhone photo. Try exporting it as JPG and uploading again.");
    return downscaleImage(new File([jpeg], rename(file, "jpg"), { type: "image/jpeg", lastModified: Date.now() }));
  }

  // AVIF, BMP, TIFF, SVG, ICO…: let the browser decode, then re-encode.
  // TIFF falls back to a small decoder, since only Safari reads TIFF natively.
  let canvas: HTMLCanvasElement;
  try {
    canvas = await decodeToCanvas(file);
  } catch {
    const tiff = /tiff?/i.test(file.type) || ["tif", "tiff"].includes(ext(file.name));
    const decoded = tiff ? await decodeTiff(file).catch(() => null) : null;
    if (!decoded) {
      throw new UnsupportedPhotoError(`This device can't read that photo format. Try JPG, PNG, HEIC, WebP or GIF.`);
    }
    canvas = decoded;
  }
  const mayBeTransparent = /svg|avif|tiff?|png|webp|icon/i.test(file.type) || ["svg", "avif", "tif", "tiff", "ico"].includes(ext(file.name));
  let blob: Blob | null;
  let type: string;
  if (mayBeTransparent) {
    blob = await toBlob(canvas, "image/webp", 0.9);
    type = "image/webp";
    if (!blob || blob.type !== "image/webp") {
      blob = await toBlob(canvas, "image/png");
      type = "image/png";
    }
  } else {
    blob = await toBlob(canvas, "image/jpeg", 0.9);
    type = "image/jpeg";
  }
  if (!blob) throw new UnsupportedPhotoError("We couldn't convert that photo. Try a JPG or PNG.");
  const outExt = type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png";
  return downscaleImage(new File([blob], rename(file, outExt), { type, lastModified: Date.now() }));
}
