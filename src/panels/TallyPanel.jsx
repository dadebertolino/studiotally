// src/panels/TallyPanel.jsx — Tally + Camera Timers + Messaging
import { useState } from "react";
import { FF, TALLY, fmt } from "../styles/constants.js";
import { t } from "../i18n.js";
import { Btn, Badge } from "../components/UI.jsx";

const CAM_TIMER_PRESETS = [
  { label: "1m", s: 60 }, { label: "2m", s: 120 }, { label: "3m", s: 180 }, { label: "5m", s: 300 },
];
const MSG_PRESETS = ["STRINGI", "ALLARGA", "30 SEC", "1 MIN", "CHIUDI", "STAND BY", "VAI", "MUOVITI"];

export function TallyPanel({
  tallies, setTallies, camNames, setCamNames, bridgeRef, sendToBridge,
  camTimers, onCamTimerStart, onCamTimerStop,
  messages, onSendMessage, onClearMessage,
}) {
  const [editingCam, setEditingCam] = useState(null);
  const [newCamName, setNewCamName] = useState("");
  const [msgTarget, setMsgTarget] = useState(null); // cam key or null
  const [msgText, setMsgText] = useState("");
  const [timerTarget, setTimerTarget] = useState(null);
  const [customM, setCustomM] = useState("");
  const [customS, setCustomS] = useState("");

  const addCamera = () => {
    const nums = Object.keys(tallies).map(k => parseInt(k.replace("cam", ""))).filter(n => !isNaN(n));
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    const key = `cam${next}`;
    setTallies(p => ({ ...p, [key]: "off" }));
    setCamNames(p => ({ ...p, [key]: `CAM ${next}` }));
  };

  const removeCamera = () => {
    const keys = Object.keys(tallies);
    if (keys.length <= 1) return;
    const last = keys[keys.length - 1];
    setTallies(p => { const n = { ...p }; delete n[last]; return n; });
    setCamNames(p => { const n = { ...p }; delete n[last]; return n; });
  };

  const renameCam = (cam, name) => {
    setCamNames(p => ({ ...p, [cam]: name || cam.toUpperCase() }));
    setEditingCam(null);
  };

  const tapCamera = (cam) => {
    setTallies(p => {
      const current = p[cam];
      const n = {};
      if (current === "off") {
        Object.keys(p).forEach(k => { n[k] = k === cam ? "preview" : p[k] === "preview" ? "off" : p[k]; });
        sendToBridge(cam, "preview");
      } else if (current === "preview") {
        Object.keys(p).forEach(k => { n[k] = k === cam ? "program" : p[k] === "program" ? "preview" : (p[k] === "preview" && k !== cam) ? "off" : p[k]; });
        sendToBridge(cam, "program");
      } else if (current === "program") {
        const currentPvw = Object.entries(p).find(([k, v]) => v === "preview");
        Object.keys(p).forEach(k => { n[k] = k === cam ? "off" : (currentPvw && k === currentPvw[0]) ? "program" : p[k]; });
        if (currentPvw) sendToBridge(currentPvw[0], "program");
      }
      return n;
    });
  };

  const forcePreview = (cam) => {
    setTallies(p => {
      const n = {};
      Object.keys(p).forEach(k => { n[k] = k === cam ? "preview" : p[k] === "preview" ? "off" : p[k]; });
      return n;
    });
    sendToBridge(cam, "preview");
  };

  const getCamTimerDisplay = (cam) => {
    const ct = camTimers?.[cam];
    if (!ct || !ct.total) return null;
    let elapsed = ct.saved || 0;
    if (ct.running && ct.mst) elapsed += Date.now() - ct.mst;
    const remaining = Math.max(0, ct.total - elapsed);
    return { remaining, expired: remaining <= 0, running: ct.running };
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

      {/* Transition bar */}
      <div style={{ border: "1px solid #1a1a2e", borderRadius: "6px", padding: "10px", background: "#0c0c16" }}>
        <div style={{ fontFamily: FF, fontSize: "0.45rem", color: "#666", letterSpacing: "0.3em", marginBottom: "8px" }}>{t("tally_transitions")}</div>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {[
            { label: "CUT", color: "#ff5555", cmd: "Cut" },
            { label: "FADE", color: "#ffb86c", cmd: "Fade" },
            { label: "FTB", color: "#ff5555", cmd: "FadeToBlack" },
            { label: "DIP", color: "#8be9fd", cmd: "Transition3" },
            { label: "WIPE", color: "#8be9fd", cmd: "Transition4" },
          ].map(tr => (
            <button key={tr.cmd} onClick={() => {
              if (tr.cmd === "FadeToBlack") {
                setTallies(p => Object.fromEntries(Object.keys(p).map(k => [k, "off"])));
              } else {
                setTallies(p => {
                  const pvwCam = Object.entries(p).find(([_, v]) => v === "preview");
                  if (!pvwCam) return p;
                  const n = {};
                  Object.keys(p).forEach(k => { n[k] = k === pvwCam[0] ? "program" : p[k] === "program" ? "preview" : p[k]; });
                  return n;
                });
              }
              if (bridgeRef) { try { bridgeRef.sendCommand(tr.cmd); } catch(e) {} }
            }} style={{
              flex: (tr.label === "CUT" || tr.label === "FADE") ? "1" : "none",
              minWidth: (tr.label === "CUT" || tr.label === "FADE") ? "0" : "52px",
              padding: "10px 12px", border: `1.5px solid ${tr.color}66`,
              background: `${tr.color}0a`, color: tr.color,
              fontFamily: FF, fontSize: "0.7rem", fontWeight: 500,
              borderRadius: "4px", cursor: "pointer", letterSpacing: "0.1em",
              WebkitTapHighlightColor: "transparent",
            }}>{tr.label}</button>
          ))}
        </div>
      </div>

      {/* Camera toolbar */}
      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
        <Btn small color="#50fa7b" onClick={addCamera}>{t("tally_add_cam")}</Btn>
        <Btn small color="#ff5555" disabled={Object.keys(tallies).length <= 1} onClick={removeCamera}>{t("tally_remove_cam")}</Btn>
        <div style={{ flex: 1 }} />
        {bridgeRef && <Badge color="#8be9fd">BRIDGE {bridgeRef.type.toUpperCase()}</Badge>}
        <Btn small color="#888" onClick={() => setTallies(p => Object.fromEntries(Object.keys(p).map(k => [k, "off"])))}>{t("tally_all_off")}</Btn>
      </div>

      {/* Camera grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {Object.entries(tallies).map(([cam, st]) => {
          const isPgm = st === "program";
          const isPvw = st === "preview";
          const isEditing = editingCam === cam;
          const cardBg = isPgm ? "#2a0808" : isPvw ? "#082a08" : "#0e0e18";
          const cardBorder = isPgm ? "#ff5555" : isPvw ? "#50fa7b88" : "#252530";
          const nameFg = isPgm ? "#fff" : isPvw ? "#e0ffe0" : "#ddd";
          const statusFg = isPgm ? "#ff5555" : isPvw ? "#50fa7b" : "#666";
          const ctd = getCamTimerDisplay(cam);
          const msg = messages?.[cam];

          return (
            <div key={cam} style={{
              background: cardBg, border: `2.5px solid ${cardBorder}`, borderRadius: "8px",
              padding: "14px 8px 10px", textAlign: "center", transition: "all 0.15s",
              boxShadow: isPgm ? "0 0 30px #ff555525" : isPvw ? "0 0 25px #50fa7b18" : "none",
              userSelect: "none", position: "relative",
            }}>
              {/* Camera name — tappable for tally */}
              <div onClick={() => { if (!isEditing) tapCamera(cam); }} style={{ cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                {isEditing ? (
                  <input autoFocus value={newCamName}
                    onClick={e => e.stopPropagation()}
                    onChange={e => setNewCamName(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === "Enter") renameCam(cam, newCamName); if (e.key === "Escape") setEditingCam(null); }}
                    onBlur={() => renameCam(cam, newCamName)}
                    style={{ width: "90%", padding: "4px 6px", border: "1px solid #50fa7b66", background: "#08080e", color: "#fff", fontFamily: FF, fontSize: "clamp(0.9rem, 4.5vw, 1.3rem)", textAlign: "center", outline: "none", borderRadius: "4px", fontWeight: 500, letterSpacing: "0.08em" }}
                  />
                ) : (
                  <div style={{ fontFamily: FF, fontSize: "clamp(0.9rem, 4.5vw, 1.3rem)", color: nameFg, letterSpacing: "0.08em", fontWeight: 500 }}>
                    {camNames[cam] || cam.toUpperCase()}
                  </div>
                )}
                <div style={{ fontFamily: FF, fontSize: "0.5rem", color: statusFg, letterSpacing: "0.3em", marginTop: "4px", animation: isPgm ? "blink 1.2s ease-in-out infinite" : "none" }}>
                  {isPgm ? t("tally_program") : isPvw ? t("tally_preview") : t("tally_off")}
                </div>
              </div>

              {/* Camera countdown timer */}
              {ctd && (
                <div style={{ marginTop: "6px", padding: "4px", borderTop: "1px solid #ffffff0a" }}>
                  <div style={{ fontFamily: FF, fontSize: "clamp(0.8rem, 3.5vw, 1.1rem)", color: ctd.expired ? "#ff5555" : ctd.remaining <= 30000 ? "#ffb86c" : "#f1fa8c", letterSpacing: "0.05em", animation: ctd.expired ? "blink 1s infinite" : "none" }}>
                    {(() => { const f = fmt(ctd.remaining); return `${f.m}:${f.s}`; })()}
                  </div>
                </div>
              )}

              {/* Active message */}
              {msg?.text && (
                <div style={{ marginTop: "4px", padding: "4px 6px", background: "#ffb86c18", border: "1px solid #ffb86c44", borderRadius: "3px" }}>
                  <div style={{ fontFamily: FF, fontSize: "0.55rem", color: "#ffb86c", letterSpacing: "0.05em", animation: "blink 2s infinite" }}>
                    {msg.text}
                  </div>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "3px", justifyContent: "center", marginTop: "8px" }} onClick={e => e.stopPropagation()}>
                <button onClick={() => { setEditingCam(cam); setNewCamName(camNames[cam] || cam); }} style={{ padding: "4px 8px", border: "1px solid #333", background: "transparent", color: "#888", fontFamily: FF, fontSize: "0.5rem", borderRadius: "3px", cursor: "pointer" }}>✏️</button>
                <button onClick={() => forcePreview(cam)} style={{ padding: "4px 8px", border: `1px solid ${isPvw ? "#50fa7b" : "#333"}`, background: isPvw ? "#50fa7b18" : "transparent", color: isPvw ? "#50fa7b" : "#999", fontFamily: FF, fontSize: "0.5rem", borderRadius: "3px", cursor: "pointer", letterSpacing: "0.05em" }}>PVW</button>
                <button onClick={() => setTimerTarget(timerTarget === cam ? null : cam)} style={{ padding: "4px 8px", border: `1px solid ${timerTarget === cam ? "#f1fa8c" : "#333"}`, background: timerTarget === cam ? "#f1fa8c18" : "transparent", color: timerTarget === cam ? "#f1fa8c" : "#999", fontFamily: FF, fontSize: "0.5rem", borderRadius: "3px", cursor: "pointer" }}>⏱</button>
                <button onClick={() => setMsgTarget(msgTarget === cam ? null : cam)} style={{ padding: "4px 8px", border: `1px solid ${msgTarget === cam ? "#ffb86c" : "#333"}`, background: msgTarget === cam ? "#ffb86c18" : "transparent", color: msgTarget === cam ? "#ffb86c" : "#999", fontFamily: FF, fontSize: "0.5rem", borderRadius: "3px", cursor: "pointer" }}>💬</button>
              </div>

              {/* Timer panel (expanded) */}
              {timerTarget === cam && (
                <div style={{ marginTop: "6px", padding: "6px", borderTop: "1px solid #1a1a2e" }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", marginBottom: "4px" }}>
                    {CAM_TIMER_PRESETS.map(p => (
                      <button key={p.s} onClick={() => { onCamTimerStart(cam, p.s * 1000); setTimerTarget(null); }} style={{ padding: "5px 8px", border: "1px solid #f1fa8c44", background: "#f1fa8c0a", color: "#f1fa8c", fontFamily: FF, fontSize: "0.55rem", borderRadius: "3px", cursor: "pointer" }}>{p.label}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                    <input type="number" placeholder="m" value={customM} onChange={e => setCustomM(e.target.value)} style={{ width: "32px", padding: "4px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "0.6rem", textAlign: "center", outline: "none", borderRadius: "3px" }} />
                    <span style={{ color: "#333", fontSize: "0.6rem" }}>:</span>
                    <input type="number" placeholder="s" value={customS} onChange={e => setCustomS(e.target.value)} style={{ width: "32px", padding: "4px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "0.6rem", textAlign: "center", outline: "none", borderRadius: "3px" }} />
                    <Btn small color="#f1fa8c" onClick={() => { const tot = ((parseInt(customM)||0)*60+(parseInt(customS)||0))*1000; if(tot>0){ onCamTimerStart(cam, tot); setCustomM(""); setCustomS(""); setTimerTarget(null); } }} style={{ padding: "4px 8px", fontSize: "0.5rem" }}>▶</Btn>
                  </div>
                  {ctd && <Btn small color="#555" onClick={() => { onCamTimerStop(cam); }} style={{ marginTop: "4px", padding: "3px 8px", fontSize: "0.45rem" }}>STOP</Btn>}
                </div>
              )}

              {/* Message panel (expanded) */}
              {msgTarget === cam && (
                <div style={{ marginTop: "6px", padding: "6px", borderTop: "1px solid #1a1a2e" }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", marginBottom: "4px" }}>
                    {MSG_PRESETS.map(m => (
                      <button key={m} onClick={() => { onSendMessage(cam, m); setMsgTarget(null); }} style={{ padding: "4px 7px", border: "1px solid #ffb86c44", background: "#ffb86c0a", color: "#ffb86c", fontFamily: FF, fontSize: "0.5rem", borderRadius: "3px", cursor: "pointer" }}>{m}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "3px" }}>
                    <input value={msgText} onChange={e => setMsgText(e.target.value.toUpperCase())} placeholder="MESSAGGIO..." style={{ flex: 1, padding: "5px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "0.55rem", outline: "none", borderRadius: "3px" }} />
                    <Btn small color="#ffb86c" onClick={() => { if (msgText.trim()) { onSendMessage(cam, msgText.trim()); setMsgText(""); setMsgTarget(null); } }} style={{ padding: "4px 8px", fontSize: "0.5rem" }}>▶</Btn>
                  </div>
                  {msg?.text && <Btn small color="#555" onClick={() => onClearMessage(cam)} style={{ marginTop: "4px", padding: "3px 8px", fontSize: "0.45rem" }}>CANCELLA MSG</Btn>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div style={{ display: "flex", gap: "16px", justifyContent: "center", alignItems: "center", padding: "10px", borderTop: "1px solid #1a1a2e", marginTop: "2px" }}>
        {(() => {
          const pgm = Object.entries(tallies).find(([_, v]) => v === "program");
          const pvw = Object.entries(tallies).find(([_, v]) => v === "preview");
          return (
            <>
              <span style={{ fontFamily: FF, fontSize: "0.7rem", color: pgm ? "#ff5555" : "#555", letterSpacing: "0.08em", fontWeight: 500 }}>
                PGM: {pgm ? (camNames[pgm[0]] || pgm[0]) : "—"}
              </span>
              <span style={{ fontFamily: FF, fontSize: "0.7rem", color: pvw ? "#50fa7b" : "#555", letterSpacing: "0.08em", fontWeight: 500 }}>
                PVW: {pvw ? (camNames[pvw[0]] || pvw[0]) : "—"}
              </span>
              <span style={{ fontFamily: FF, fontSize: "0.55rem", color: "#666", letterSpacing: "0.08em" }}>
                {Object.keys(tallies).length} cam
              </span>
            </>
          );
        })()}
      </div>
    </div>
  );
}
