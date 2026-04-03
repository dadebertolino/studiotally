// src/screens/Lobby.jsx
import { useState, useEffect } from "react";
import { FF } from "../styles/constants.js";
import { t } from "../i18n.js";
import { Btn, Badge, Card, Label } from "../components/UI.jsx";
import { ROOM_TTL_PRESETS, DEFAULT_TTL_HOURS, getRoomMeta } from "../firebase-config.js";

export function Lobby({ onCreateRoom, onJoinRoom, onRejoin, onLanConnect, onBack }) {
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [ttlHours, setTtlHours] = useState(DEFAULT_TTL_HOURS);
  const [savedRoom, setSavedRoom] = useState(null);
  const [lanIp, setLanIp] = useState("");
  const [lanRole, setLanRole] = useState("viewer"); // "master" | "viewer"

  // Check for saved active room
  useEffect(() => {
    try {
      const raw = localStorage.getItem("studiotally:activeRoom");
      if (raw) {
        const data = JSON.parse(raw);
        // LAN saved session
        if (data.lan && data.wsUrl) {
          setSavedRoom(data);
          return;
        }
        if (data.code && data.expiresAt > Date.now()) {
          getRoomMeta(data.code).then(meta => {
            if (meta) setSavedRoom({ ...data, ...meta });
            else localStorage.removeItem("studiotally:activeRoom");
          });
        } else {
          localStorage.removeItem("studiotally:activeRoom");
        }
      }
    } catch(e) {}
  }, []);

  const fmtRemaining = (expiresAt) => {
    const diff = expiresAt - Date.now();
    if (diff <= 0) return t("lobby_expired");
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const handleLanConnect = () => {
    const ip = lanIp.trim();
    if (!ip) { setErr("Inserisci l'IP del bridge"); return; }
    const wsUrl = ip.includes("://") ? ip : `ws://${ip}:9900`;
    try { localStorage.setItem("studiotally:activeRoom", JSON.stringify({ lan: true, wsUrl, role: lanRole })); } catch(e) {}
    onLanConnect(wsUrl, lanRole);
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "24px", gap: "14px" }}>
      <div className="safe-top" style={{ position: "absolute", top: "0", left: "12px" }}>
        <Btn small color="#333" onClick={onBack}>←</Btn>
      </div>
      <div style={{ fontFamily: FF, color: "#eee", fontSize: "1rem", letterSpacing: "0.2em" }}>{t("lobby_title")}</div>

      {/* ── REJOIN ── */}
      {savedRoom && (
        <Card style={{ width: "min(88vw, 350px)", border: "1px solid #ffb86c33" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontFamily: FF, color: "#ffb86c", fontSize: "0.6rem", letterSpacing: "0.35em" }}>{savedRoom.lan ? "LAN" : t("lobby_rejoin")}</span>
            <Badge color="#ffb86c">{(savedRoom.role === "master" ? t("lobby_role_master") : t("lobby_role_viewer"))}</Badge>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <span style={{ fontFamily: FF, color: "#eee", fontSize: savedRoom.lan ? "0.8rem" : "1.1rem", letterSpacing: "0.15em" }}>
              {savedRoom.lan ? savedRoom.wsUrl : savedRoom.code}
            </span>
            {!savedRoom.lan && savedRoom.expiresAt && (
              <span style={{ fontFamily: FF, color: "#666", fontSize: "0.55rem" }}>
                {t("lobby_remaining")}: {fmtRemaining(savedRoom.expiresAt)}
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <Btn color="#ffb86c" filled block onClick={() => {
              if (savedRoom.lan) onLanConnect(savedRoom.wsUrl, savedRoom.role);
              else onRejoin(savedRoom.code, savedRoom.role);
            }}>{t("lobby_rejoin_btn")}</Btn>
            <Btn small color="#555" onClick={() => { localStorage.removeItem("studiotally:activeRoom"); setSavedRoom(null); }}>✕</Btn>
          </div>
        </Card>
      )}

      {/* ── CLOUD: CREATE ── */}
      <Card style={{ width: "min(88vw, 350px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <span style={{ fontFamily: FF, color: "#50fa7b", fontSize: "0.6rem", letterSpacing: "0.35em" }}>{t("lobby_create")}</span>
          <Badge color="#50fa7b">CLOUD</Badge>
        </div>
        <Label>{t("lobby_ttl_label")}</Label>
        <div style={{ display: "flex", gap: "5px", marginBottom: "14px", flexWrap: "wrap" }}>
          {ROOM_TTL_PRESETS.map(p => (
            <button key={p.hours} onClick={() => setTtlHours(p.hours)} style={{
              padding: "7px 11px", border: `1px solid ${ttlHours === p.hours ? "#50fa7b66" : "#1a1a2e"}`,
              background: ttlHours === p.hours ? "#50fa7b12" : "#08080e",
              color: ttlHours === p.hours ? "#50fa7b" : "#666",
              fontFamily: FF, fontSize: "0.7rem", borderRadius: "4px", cursor: "pointer",
            }}>{p.label}</button>
          ))}
        </div>
        <Btn color="#50fa7b" filled block onClick={() => onCreateRoom(ttlHours)}>{t("lobby_create_btn")}</Btn>
      </Card>

      {/* ── CLOUD: JOIN ── */}
      <Card style={{ width: "min(88vw, 350px)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
          <span style={{ fontFamily: FF, color: "#8be9fd", fontSize: "0.6rem", letterSpacing: "0.35em" }}>{t("lobby_join")}</span>
          <Badge color="#8be9fd">CLOUD</Badge>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <input value={code} onChange={e => { setCode(e.target.value.toUpperCase().slice(0, 5)); setErr(""); }} placeholder={t("lobby_join_placeholder")} style={{ flex: 1, padding: "11px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "1rem", textAlign: "center", letterSpacing: "0.5em", outline: "none", borderRadius: "4px" }} />
          <Btn color="#8be9fd" disabled={code.length < 5 || loading} onClick={async () => { setLoading(true); const ok = await onJoinRoom(code); setLoading(false); if (!ok) setErr(t("lobby_not_found")); }}>{t("lobby_join_btn")}</Btn>
        </div>
        {err && <div style={{ fontFamily: FF, color: "#ff5555", fontSize: "0.65rem", marginTop: "6px" }}>{err}</div>}
      </Card>

      {/* ── LAN MODE ── */}
      <Card style={{ width: "min(88vw, 350px)", border: "1px solid #ffb86c33" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
          <span style={{ fontFamily: FF, color: "#ffb86c", fontSize: "0.6rem", letterSpacing: "0.35em" }}>CONNESSIONE LAN</span>
          <Badge color="#ffb86c">NO INTERNET</Badge>
        </div>
        <div style={{ fontFamily: FF, color: "#555", fontSize: "0.55rem", marginBottom: "10px", lineHeight: 1.6 }}>
          Connetti direttamente al bridge sul PC di regia. L'IP è mostrato nella finestra del bridge.
        </div>
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <input value={lanIp} onChange={e => { setLanIp(e.target.value); setErr(""); }} placeholder="192.168.1.50" style={{ flex: 1, padding: "10px", border: "1px solid #1a1a2e", background: "#08080e", color: "#ffb86c", fontFamily: FF, fontSize: "0.9rem", textAlign: "center", outline: "none", borderRadius: "4px" }} />
        </div>
        <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
          {["master", "viewer"].map(r => (
            <button key={r} onClick={() => setLanRole(r)} style={{
              flex: 1, padding: "8px", border: `1px solid ${lanRole === r ? "#ffb86c66" : "#1a1a2e"}`,
              background: lanRole === r ? "#ffb86c12" : "#08080e",
              color: lanRole === r ? "#ffb86c" : "#666",
              fontFamily: FF, fontSize: "0.65rem", borderRadius: "4px", cursor: "pointer",
              textTransform: "uppercase", letterSpacing: "0.15em",
            }}>{r === "master" ? t("lobby_role_master") : t("lobby_role_viewer")}</button>
          ))}
        </div>
        <Btn color="#ffb86c" filled block onClick={handleLanConnect}>▶ CONNETTI LAN</Btn>
      </Card>
    </div>
  );
}
