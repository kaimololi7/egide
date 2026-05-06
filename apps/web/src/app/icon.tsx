/**
 * Dynamic 32×32 favicon — token-driven, no static asset.
 * Renders an "e" letter on a flat dark surface with the accent dot,
 * matching ADR 017 design tokens (no gradient, no shadow).
 */
import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        background: "#0a0a0a",
        color: "#ededed",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "monospace",
        fontSize: 22,
        fontWeight: 600,
        position: "relative",
        borderRadius: 6,
      }}
    >
      e
      <span
        style={{
          position: "absolute",
          right: 4,
          top: 4,
          width: 6,
          height: 6,
          borderRadius: 3,
          background: "#3da9fc",
        }}
      />
    </div>,
    { ...size },
  );
}
