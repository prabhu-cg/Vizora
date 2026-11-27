export interface BrowserSupport {
  storage: boolean;
  files: boolean;
  downloads: boolean;
  hashing: boolean;
  workers: boolean;
  clipboard: boolean;
}

/** What this browser can do, so the app can explain a limitation instead of failing mysteriously. */
export function detectSupport(g: Partial<typeof globalThis> = globalThis): BrowserSupport {
  const has = (k: string) => typeof (g as Record<string, unknown>)[k] !== "undefined";
  const nav = g.navigator;
  return {
    storage: has("indexedDB"),
    files: has("File") && has("FileReader"),
    downloads: has("Blob") && typeof (g as { URL?: { createObjectURL?: unknown } }).URL?.createObjectURL === "function",
    hashing: Boolean((g as { crypto?: { subtle?: unknown } }).crypto?.subtle),
    workers: has("Worker"),
    clipboard: Boolean(nav?.clipboard?.writeText),
  };
}

export const SUPPORT_NOTES: Record<keyof BrowserSupport, { label: string; without: string }> = {
  storage: { label: "Saving projects in this browser", without: "Vizora cannot save your work. This can happen in some private-browsing modes; try a normal window." },
  files: { label: "Opening files", without: "You cannot import files. Paste or type your data instead." },
  downloads: { label: "Downloading exports", without: "Exports and backups cannot be downloaded in this browser." },
  hashing: { label: "File checksums", without: "Imported files will not show a checksum. Everything else works." },
  workers: { label: "Background processing", without: "Large files are processed on the page and may make it pause for a few seconds." },
  clipboard: { label: "Copying embed code", without: "Use “HTML embed page” in the Export menu instead of copying." },
};
