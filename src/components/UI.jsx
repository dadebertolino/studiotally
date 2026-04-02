// src/components/UI.jsx — All shared UI components
import { FF, TALLY, fmt } from "../styles/constants.js";

export function Btn({ children, color = "#888", filled, onClick, disabled, small, block, style: sx }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      border: `2px solid ${disabled ? "#222" : color}`, background: filled && !disabled ? color + "15" : "transparent",
      fontFamily: FF, fontSize: small ? "0.68rem" : "0.8rem", padding: small ? "8px 14px" : "12px 22px",
      cursor: disabled ? "default" : "pointer", color: disabled ? "#333" : color,
      textTransform: "uppercase", letterSpacing: "0.12em", borderRadius: "4px",
      transition: "all 0.1s", opacity: disabled ? 0.35 : 1, WebkitTapHighlightColor: "transparent",
      width: block ? "100%" : "auto", ...sx,
    }}>{children}</button>
  );
}

export function Badge({ children, color }) {
  return <span style={{ fontFamily: FF, fontSize: "0.48rem", letterSpacing: "0.2em", color, border: `1px solid ${color}44`, borderRadius: "3px", padding: "2px 7px", background: color + "0c" }}>{children}</span>;
}

export function Card({ children, style: sx }) {
  return <div style={{ border: "1px solid #151522", borderRadius: "6px", padding: "14px", background: "#0c0c14", ...sx }}>{children}</div>;
}

export function Label({ children }) {
  return <div style={{ fontFamily: FF, color: "#555", fontSize: "0.55rem", letterSpacing: "0.35em", marginBottom: "10px" }}>{children}</div>;
}

export function StatusDot({ status }) {
  const colors = { connected: "#50fa7b", connecting: "#f1fa8c", reconnecting: "#f1fa8c", error: "#ff5555", disconnected: "#444" };
  const c = colors[status] || "#444";
  return <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: c, boxShadow: status === "connected" ? `0 0 6px ${c}` : "none", marginRight: "6px", animation: status === "connecting" || status === "reconnecting" ? "blink 1s infinite" : "none" }} />;
}

export function TimerDigits({ ms, color, size = "large" }) {
  const t = fmt(ms);
  const sz = size === "large" ? "clamp(3rem, 15vw, 8rem)" : "clamp(1.6rem, 7vw, 3rem)";
  const sepSz = size === "large" ? "clamp(2.2rem, 11vw, 6rem)" : "clamp(1.2rem, 5vw, 2.2rem)";
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: "1px" }}>
      {["h", "m", "s"].map((u, i) => (
        <span key={u} style={{ display: "contents" }}>
          {i > 0 && <span style={{ fontFamily: FF, fontSize: sepSz, color: color + "44", lineHeight: 1 }}>:</span>}
          <span style={{ fontFamily: FF, fontSize: sz, color, letterSpacing: "0.03em", textShadow: `0 0 30px ${color}28`, lineHeight: 1 }}>{t[u]}</span>
        </span>
      ))}
      <span style={{ fontFamily: FF, fontSize: size === "large" ? "clamp(1rem, 4vw, 2rem)" : "clamp(0.7rem, 2.5vw, 1rem)", color: color + "44", marginLeft: "2px", lineHeight: 1 }}>.{t.cs}</span>
    </div>
  );
}

export function TallyCard({ status, name, big, onClick }) {
  const tally = TALLY[status] || TALLY.off;
  return (
    <div onClick={onClick} style={{
      background: tally.bg, border: `2px solid ${tally.border}`, borderRadius: "6px",
      padding: big ? "24px 12px" : "12px 8px", textAlign: "center",
      cursor: onClick ? "pointer" : "default", transition: "all 0.15s",
      boxShadow: status !== "off" ? `0 0 20px ${tally.text}15` : "none",
      WebkitTapHighlightColor: "transparent",
    }}>
      <div style={{
        fontFamily: FF, fontSize: big ? "clamp(1.8rem, 9vw, 4rem)" : "clamp(0.9rem, 3.5vw, 1.4rem)",
        color: tally.text, letterSpacing: "0.25em",
        animation: status === "program" ? "blink 1s ease-in-out infinite" : "none",
      }}>{tally.label}</div>
      {name && <div style={{ fontFamily: FF, fontSize: big ? "0.7rem" : "0.5rem", color: tally.text + "66", marginTop: "4px", letterSpacing: "0.25em" }}>{name}</div>}
    </div>
  );
}
