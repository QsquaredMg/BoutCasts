/**
 * Share a drawn prediction graphic (crowd picks, winners) with a caption and link.
 *
 * Many apps drop the text when a file is shared (Facebook especially), so the caption and link are
 * also copied to the clipboard. The copy has to start inside the tap, before the async image step,
 * or the browser refuses it. `onNote` gets a short line to show the person afterwards.
 */
export function shareGraphic(
  canvas: HTMLCanvasElement,
  o: { fileName: string; title: string; caption?: string },
  onNote: (note: string) => void,
) {
  const text = o.caption ? `${o.caption} ${window.location.href}` : undefined;
  const copied: Promise<boolean> = text && navigator.clipboard
    ? navigator.clipboard.writeText(text).then(() => true, () => false)
    : Promise.resolve(false);

  canvas.toBlob(async (b) => {
    if (!b) return;
    const file = new File([b], `${o.fileName}.png`, { type: "image/png" });
    try {
      if (!navigator.canShare({ files: [file] })) return;
      await navigator.share({ files: [file], title: o.title, ...(text ? { text } : {}) });
      if (await copied) onNote("Caption and link copied. If your app didn't fill them in, paste them into your post.");
    } catch {
      // cancelled
    }
  });
}
