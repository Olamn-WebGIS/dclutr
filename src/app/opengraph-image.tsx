import { ImageResponse } from "next/og";

export const alt = "D_clutr — used items for FUTA students in Akure";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        alignItems: "center",
        background: "#f8f7f1",
        color: "#203a2e",
        padding: "72px 84px",
      }}
    >
      <div
        style={{
          display: "flex",
          position: "absolute",
          width: 560,
          height: 560,
          right: -90,
          top: 38,
          borderRadius: 280,
          background: "#e3eadf",
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", width: 760, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, color: "#486b50", fontSize: 24, letterSpacing: 4 }}>
          MADE FOR FUTA, AKURE
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 36, fontSize: 76, fontWeight: 700, lineHeight: 1.08, letterSpacing: -3 }}>
          <span>D_clutr items,</span>
          <span style={{ color: "#486b50" }}>second chapters.</span>
        </div>
        <div style={{ display: "flex", marginTop: 30, maxWidth: 700, color: "#526258", fontSize: 28, lineHeight: 1.4 }}>
          Find affordable used essentials and sell useful things on to other FUTA students.
        </div>
        <div style={{ display: "flex", marginTop: 38, color: "#244b39", fontSize: 22, fontWeight: 600 }}>
          dclutr.com.ng
        </div>
      </div>
      <div
        style={{
          display: "flex",
          position: "absolute",
          right: 118,
          bottom: 112,
          width: 150,
          height: 150,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 36,
          background: "#244b39",
          color: "#f8f7f1",
          fontSize: 88,
          fontWeight: 700,
        }}
      >
        d
      </div>
    </div>,
    { ...size },
  );
}
