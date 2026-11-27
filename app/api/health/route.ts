export function GET() {
  return Response.json(
    { status: "ok", name: "VIZORA", edition: "free", version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
