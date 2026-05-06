/**
 * Apple touch icon — same identity as favicon, scaled for iOS home
 * screen. ADR 017 tokens.
 */
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
        fontSize: 110,
        fontWeight: 600,
        position: "relative",
        borderRadius: 32,
      }}
    >
      e
      <span
        style={{
          position: "absolute",
          right: 24,
          top: 24,
          width: 28,
          height: 28,
          borderRadius: 14,
          background: "#3da9fc",
        }}
      />
    </div>,
    { ...size },
  );
}
