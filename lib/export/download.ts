/** Trigger a browser download for a Blob. Browser-only. */
export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke after the click has been processed.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
