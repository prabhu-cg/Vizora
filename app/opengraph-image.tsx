import { ImageResponse } from "next/og";

export const alt = "Vizora — See beyond information";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Social card. Rendered at build time; uses the Butter palette as literals because this image has no CSS. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#fcfaf3", padding: 80 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <svg width="84" height="80" viewBox="0 0 134 128" fill="none">
            <path d="M25.1456 0H8.52703C1.91617 0 -2.17249 7.19237 1.21838 12.8567L70.1472 128L84.5294 93.0691C85.5273 90.6455 85.3492 87.8979 84.0467 85.6228L39.9299 8.56355C36.8983 3.26807 31.2562 0 25.1456 0Z" fill="#202B27" />
            <path d="M134 0H91.6927C78.6961 0 70.4906 13.9469 76.8221 25.2756L97.7225 62.6722L134 0Z" fill="#D4A615" />
          </svg>
          <div style={{ fontSize: 56, color: "#353335", fontFamily: "Georgia, serif" }}>Vizora</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", flexWrap: "wrap", fontSize: 96, lineHeight: 1.05, color: "#353335", fontFamily: "Georgia, serif", letterSpacing: -2 }}>
            <span style={{ marginRight: 24 }}>Turn</span>
            <span style={{ color: "#826400", marginRight: 24 }}>anything</span>
            <span>into a visual.</span>
          </div>
          <div style={{ fontSize: 36, color: "#6b6b6b" }}>See beyond information. Free and local-first.</div>
        </div>
      </div>
    ),
    size,
  );
}
