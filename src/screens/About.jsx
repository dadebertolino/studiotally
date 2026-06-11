// src/screens/About.jsx — Info & versione
import { useState, useEffect } from "react";
import { FF } from "../styles/constants.js";
import { t } from "../i18n.js";
import { Btn, Badge, Card, Label, StatusDot } from "../components/UI.jsx";
import { APP_VERSION, BUILD_DATE } from "../styles/constants.js";

const HTTP_URL = "https://ws.studiotally.com";

export function About({ onBack }) {
  const [f, setF] = useState(0);
  const [backend, setBackend] = useState("connecting"); // connecting | connected | error

  useEffect(() => { setTimeout(() => setF(1), 50); }, []);

  // Health check del backend VPS
  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 4000);
        const r = await fetch(`${HTTP_URL}/health`, { signal: ctrl.signal });
        clearTimeout(to);
        if (alive) setBackend(r.ok ? "connected" : "error");
      } catch (e) { if (alive) setBackend("error"); }
    };
    check();
    const itv = setInterval(check, 15000);
    return () => { alive = false; clearInterval(itv); };
  }, []);

  const backendLabel = { connected: "ONLINE", connecting: "...", error: "OFFLINE" }[backend];
  const backendColor = { connected: "#50fa7b", connecting: "#f1fa8c", error: "#ff5555" }[backend];

  const Row = ({ k, v, color = "#888" }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0", borderBottom: "1px solid #12121e" }}>
      <span style={{ fontFamily: FF, color: "#555", fontSize: "0.6rem", letterSpacing: "0.15em" }}>{k}</span>
      <span style={{ fontFamily: FF, color, fontSize: "0.62rem", letterSpacing: "0.08em" }}>{v}</span>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", padding: "24px", opacity: f, transition: "opacity 0.4s" }}>
      <div className="safe-top" style={{ position: "absolute", top: "0", left: "12px" }}>
        <Btn small color="#333" onClick={onBack}>←</Btn>
      </div>

      {/* Logo + titolo */}
      <div style={{ marginTop: "40px", marginBottom: "24px", textAlign: "center" }}>
        <div style={{ width: "48px", height: "48px", border: "2px solid #ff555577", borderRadius: "50%", margin: "0 auto 14px", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 25px #ff555518" }}>
          <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#ff5555", boxShadow: "0 0 8px #ff5555", animation: "blink 2s infinite" }} />
        </div>
        <div style={{ fontFamily: FF, fontSize: "1.6rem", color: "#eee", letterSpacing: "0.18em" }}>StudioTally</div>
        <div style={{ fontFamily: FF, fontSize: "0.6rem", color: "#50fa7b", letterSpacing: "0.4em", marginTop: "4px" }}>v{APP_VERSION}</div>
      </div>

      {/* Card versione / sistema */}
      <Card style={{ width: "min(88vw, 360px)", marginBottom: "14px" }}>
        <Label>{t("about_system")}</Label>
        <Row k={t("about_version")} v={`v${APP_VERSION}`} color="#50fa7b" />
        <Row k={t("about_build")} v={BUILD_DATE} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 0" }}>
          <span style={{ fontFamily: FF, color: "#555", fontSize: "0.6rem", letterSpacing: "0.15em" }}>{t("about_backend")}</span>
          <span style={{ fontFamily: FF, fontSize: "0.62rem", letterSpacing: "0.08em", color: backendColor, display: "flex", alignItems: "center" }}>
            <StatusDot status={backend} />{backendLabel}
          </span>
        </div>
      </Card>

      {/* Card descrizione */}
      <Card style={{ width: "min(88vw, 360px)", marginBottom: "14px" }}>
        <Label>{t("about_what")}</Label>
        <div style={{ fontFamily: FF, color: "#888", fontSize: "0.62rem", lineHeight: 1.8 }}>
          {t("about_desc")}
        </div>
      </Card>

      {/* Card link */}
      <Card style={{ width: "min(88vw, 360px)", marginBottom: "20px" }}>
        <Label>{t("about_links")}</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <a href="https://studiotally.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 11px", border: "1px solid #151522", borderRadius: "5px", background: "#08080e" }}>
              <span style={{ fontFamily: FF, color: "#8be9fd", fontSize: "0.62rem" }}>🌐 studiotally.com</span>
              <span style={{ fontFamily: FF, color: "#333", fontSize: "0.7rem" }}>↗</span>
            </div>
          </a>
          <a href="https://github.com/dadebertolino/studiotally" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 11px", border: "1px solid #151522", borderRadius: "5px", background: "#08080e" }}>
              <span style={{ fontFamily: FF, color: "#ccc", fontSize: "0.62rem" }}>⌨ GitHub</span>
              <span style={{ fontFamily: FF, color: "#333", fontSize: "0.7rem" }}>↗</span>
            </div>
          </a>
        </div>
      </Card>

      {/* Footer */}
      <div style={{ fontFamily: FF, color: "#2a2a3a", fontSize: "0.5rem", letterSpacing: "0.2em", textAlign: "center", marginTop: "auto", paddingTop: "20px" }}>
        © {new Date().getFullYear()} Davide Bertolino · MIT License
      </div>
    </div>
  );
}
