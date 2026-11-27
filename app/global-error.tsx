"use client";

/** Last-resort boundary: replaces the root layout, so it must render its own <html>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#F7F8FA", color: "#111827", margin: 0 }}>
        <main style={{ maxWidth: 480, margin: "20vh auto", padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 24 }}>VIZORA couldn’t start</h1>
          <p style={{ color: "#6B6B6B" }}>Your saved work is not affected. Try reloading.</p>
          <button
            onClick={reset}
            style={{ background: "#1D63D8", color: "#fff", border: 0, borderRadius: 8, padding: "10px 18px", fontSize: 16, cursor: "pointer" }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
