/** Collision-resistant identifier. Uses the platform CSPRNG; no dependency. */
export function createId(): string {
  return globalThis.crypto.randomUUID();
}
