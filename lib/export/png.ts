/** Largest canvas edge browsers handle reliably. */
export const MAX_CANVAS_EDGE = 8192;

export interface RasteriseDeps {
  createImage?: () => HTMLImageElement;
  createCanvas?: () => HTMLCanvasElement;
}

/**
 * Rasterise an SVG string to a PNG blob in the browser, on a white background
 * (so transparent areas are not black). The scale is reduced if needed to stay
 * within canvas limits; `scale` 2 gives crisp output on high-density screens.
 */
export async function svgToPng(svg: string, width: number, height: number, scale = 2, deps: RasteriseDeps = {}): Promise<Blob> {
  const factor = Math.max(0.1, Math.min(scale, MAX_CANVAS_EDGE / Math.max(width, height)));
  const img = deps.createImage?.() ?? new Image();
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("The image could not be rendered."));
      img.width = width;
      img.height = height;
      img.src = url;
    });
    const canvas = deps.createCanvas?.() ?? document.createElement("canvas");
    canvas.width = Math.round(width * factor);
    canvas.height = Math.round(height * factor);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser cannot draw images.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("PNG encoding failed."))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
