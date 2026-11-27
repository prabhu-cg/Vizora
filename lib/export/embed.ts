import type { VisualisationIR } from "@/types/visualisation";
import { drawable, renderSvgFor } from "./image-exporters";
import { slugify } from "./slug";
import type { Exporter } from "./types";

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Make an SVG safe to paste into someone else's page: responsive instead of
 * fixed-size, and with every internal id made unique so two embeds (or the
 * host page) can never clash over arrowheads, patterns or clip paths.
 */
export function embeddableSvg(svg: string, width: number, uid: string): string {
  let out = svg.replace(/<\?xml[^>]*\?>\s*/i, "").trim();
  const ids = [...out.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]!);
  for (const id of new Set(ids)) {
    const next = `${uid}-${id}`;
    out = out.split(`id="${id}"`).join(`id="${next}"`).split(`url(#${id})`).join(`url(#${next})`).split(`href="#${id}"`).join(`href="#${next}"`);
  }
  // Replace the fixed width/height on the root element with a fluid size that keeps the aspect ratio (the viewBox stays).
  out = out.replace(/<svg\b([^>]*)>/i, (_m, attrs: string) => {
    const kept = attrs.replace(/\s(width|height|style)="[^"]*"/g, "");
    return `<svg${kept} style="display:block;width:100%;max-width:${Math.round(width)}px;height:auto">`;
  });
  return out;
}

const hash = (s: string) => {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
};

/** A snippet to paste into any page: the picture, inline, with a caption. Static: it does not update or contact Vizora. */
export async function embedSnippet(doc: VisualisationIR): Promise<string> {
  const { svg, width } = await renderSvgFor(doc);
  const uid = `vz${hash(doc.id + doc.updatedAt)}`;
  const body = embeddableSvg(svg, width, uid);
  return `<!-- Vizora embed: "${escapeHtml(doc.title)}". A static picture; it does not update when the visualisation changes. -->\n<figure class="vizora-embed" style="margin:0">\n${body}\n<figcaption style="font:14px/1.4 system-ui,sans-serif;color:#555;margin-top:8px">${escapeHtml(doc.title)}</figcaption>\n</figure>\n`;
}

/** Copy the snippet to the clipboard. Returns false if the browser refuses, so the caller can offer the file instead. */
export async function copyEmbedCode(doc: VisualisationIR): Promise<boolean> {
  const snippet = await embedSnippet(doc);
  try {
    await navigator.clipboard.writeText(snippet);
    return true;
  } catch {
    return false;
  }
}

export const embedExporter: Exporter = {
  id: "html-embed",
  label: "HTML embed page",
  description: "A standalone web page containing the picture, ready to host or open. Static.",
  feature: "export.svg",
  supports: drawable,
  async run(doc) {
    const snippet = await embedSnippet(doc);
    const html = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${escapeHtml(doc.title)}</title>\n<style>body{margin:0;padding:24px;background:#fff}</style>\n</head>\n<body>\n${snippet}</body>\n</html>\n`;
    return { filename: `${slugify(doc.title)}-embed.html`, blob: new Blob([html], { type: "text/html" }) };
  },
};
