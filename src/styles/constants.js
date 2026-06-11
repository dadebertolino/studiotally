// src/styles/constants.js
export const FF = "'JetBrains Mono', 'Share Tech Mono', 'Courier New', monospace";

export const TALLY = {
  off:      { bg: "#0c0c14", border: "#1a1a2e", text: "#444", label: "OFF" },
  preview:  { bg: "#071a07", border: "#50fa7b55", text: "#50fa7b", label: "PVW" },
  program:  { bg: "#1a0707", border: "#ff555588", text: "#ff5555", label: "PGM" },
};

export const PRESETS = [
  { label: "30s", s: 30 }, { label: "1m", s: 60 }, { label: "2m", s: 120 },
  { label: "3m", s: 180 }, { label: "5m", s: 300 }, { label: "10m", s: 600 },
];

export const fmt = (ms) => {
  const t = Math.max(0, Math.floor(ms / 1000));
  return {
    h: String(Math.floor(t / 3600)).padStart(2, "0"),
    m: String(Math.floor((t % 3600) / 60)).padStart(2, "0"),
    s: String(t % 60).padStart(2, "0"),
    cs: String(Math.floor((Math.max(0, ms) % 1000) / 10)).padStart(2, "0"),
  };
};

export const genCode = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => c[Math.floor(Math.random() * c.length)]).join("");
};

// ── Versione app ──
export const APP_VERSION = "2.0.0";      // tieni allineato a package.json
export const BUILD_DATE = "2026-06-11";  // aggiorna ai rilasci
