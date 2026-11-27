/**
 * Content Security Policy (production only; the dev server needs eval for hot reload).
 * Vizora makes no requests to other origins, and connect-src 'self' enforces that.
 * 'unsafe-inline' for scripts is required by Next.js's inline bootstrap and the
 * theme-before-paint script; there is no eval and no remote script.
 */
export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");
