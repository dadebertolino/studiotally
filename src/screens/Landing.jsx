// src/screens/Landing.jsx
import { useState, useEffect } from "react";
import { FF } from "../styles/constants.js";
import { t } from "../i18n.js";
import { Btn } from "../components/UI.jsx";

export function Landing({ onStart, onAbout }) {
  const [f, setF] = useState(0);
  useEffect(() => { setTimeout(() => setF(1), 50); }, []);
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", opacity: f, transition: "opacity 0.5s" }}>
      <div style={{ marginBottom: "36px", textAlign: "center" }}>
        <div style={{ width: "56px", height: "56px", border: "2px solid #ff555577", borderRadius: "50%", margin: "0 auto 16px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 25px #ff555518" }}>
          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ff5555", boxShadow: "0 0 8px #ff5555", animation: "blink 2s infinite" }} />
        </div>
        <div style={{ fontFamily: FF, fontSize: "clamp(1.6rem, 6vw, 2.4rem)", color: "#eee", letterSpacing: "0.18em" }}>{t("landing_title")}</div>
        <div style={{ fontFamily: FF, fontSize: "clamp(0.6rem, 2vw, 0.8rem)", color: "#50fa7b", letterSpacing: "0.5em", marginTop: "4px" }}>{t("landing_subtitle")}</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "min(85vw, 340px)", marginBottom: "32px" }}>
        {[
          { i: "⏱", tk: "landing_feat1_t", dk: "landing_feat1_d" },
          { i: "🔴", tk: "landing_feat2_t", dk: "landing_feat2_d" },
          { i: "🔌", tk: "landing_feat3_t", dk: "landing_feat3_d" },
          { i: "📱", tk: "landing_feat4_t", dk: "landing_feat4_d" },
        ].map((f, i) => (
          <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", padding: "10px 12px", border: "1px solid #12121e", borderRadius: "6px", background: "#0c0c14", opacity: 0, animation: `fadeSlide 0.35s ease ${0.15 + i * 0.08}s forwards` }}>
            <span style={{ fontSize: "1.1rem", lineHeight: 1.4 }}>{f.i}</span>
            <div>
              <div style={{ fontFamily: FF, color: "#ccc", fontSize: "0.72rem" }}>{t(f.tk)}</div>
              <div style={{ fontFamily: FF, color: "#3a3a4a", fontSize: "0.58rem", marginTop: "2px", lineHeight: 1.4 }}>{t(f.dk)}</div>
            </div>
          </div>
        ))}
      </div>
      <Btn color="#50fa7b" filled onClick={onStart} style={{ padding: "14px 44px", fontSize: "0.9rem" }}>{t("landing_start")}</Btn>
    </div>
  );
}
