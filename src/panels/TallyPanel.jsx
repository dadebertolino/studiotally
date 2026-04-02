// src/panels/TallyPanel.jsx
import { useState } from "react";
import { FF, TALLY } from "../styles/constants.js";
import { t } from "../i18n.js";
import { Btn, Badge } from "../components/UI.jsx";

export function TallyPanel({ tallies, setTallies, camNames, setCamNames, bridgeRef, sendToBridge }) {
  const [editingCam, setEditingCam] = useState(null);
  const [newCamName, setNewCamName] = useState("");

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

  // Pipeline tap: OFF → PVW → PGM → OFF, with proper cascade
  const tapCamera = (cam) => {
    setTallies(p => {
      const current = p[cam];
      const n = {};

      if (current === "off") {
        Object.keys(p).forEach(k => {
          if (k === cam) n[k] = "preview";
          else if (p[k] === "preview") n[k] = "off";
          else n[k] = p[k];
        });
        sendToBridge(cam, "preview");
      } else if (current === "preview") {
        Object.keys(p).forEach(k => {
          if (k === cam) n[k] = "program";
          else if (p[k] === "program") n[k] = "preview";
          else if (p[k] === "preview" && k !== cam) n[k] = "off";
          else n[k] = p[k];
        });
        sendToBridge(cam, "program");
      } else if (current === "program") {
        const currentPvw = Object.entries(p).find(([k, v]) => v === "preview");
        Object.keys(p).forEach(k => {
          if (k === cam) n[k] = "off";
          else if (currentPvw && k === currentPvw[0]) n[k] = "program";
          else n[k] = p[k];
        });
        if (currentPvw) sendToBridge(currentPvw[0], "program");
      }
      return n;
    });
  };

  const forcePreview = (cam) => {
    setTallies(p => {
      const n = {};
      Object.keys(p).forEach(k => {
        if (k === cam) n[k] = "preview";
        else if (p[k] === "preview") n[k] = "off";
        else n[k] = p[k];
      });
      return n;
    });
    sendToBridge(cam, "preview");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

      {/* Transition bar */}
      <div style={{ border: "1px solid #1a1a2e", borderRadius: "6px", padding: "10px", background: "#0c0c16" }}>
        <div style={{ fontFamily: FF, fontSize: "0.45rem", color: "#666", letterSpacing: "0.3em", marginBottom: "8px" }}>{t("tally_transitions")}</div>
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          {[
            { label: "CUT",  color: "#ff5555", cmd: "Cut" },
            { label: "FADE", color: "#ffb86c", cmd: "Fade" },
            { label: "FTB",  color: "#ff5555", cmd: "FadeToBlack" },
            { label: "DIP",  color: "#8be9fd", cmd: "Transition3" },
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
                  Object.keys(p).forEach(k => {
                    if (k === pvwCam[0]) n[k] = "program";
                    else if (p[k] === "program") n[k] = "preview";
                    else n[k] = p[k];
                  });
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

      {/* Hint */}
      <div style={{ fontFamily: FF, fontSize: "0.45rem", color: "#555", textAlign: "center", letterSpacing: "0.05em" }}>
        {t("tally_hint")}
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

          return (
            <div key={cam} onClick={() => { if (!isEditing) tapCamera(cam); }} style={{
              background: cardBg, border: `2.5px solid ${cardBorder}`, borderRadius: "8px",
              padding: "20px 10px 14px", textAlign: "center", transition: "all 0.15s",
              boxShadow: isPgm ? "0 0 30px #ff555525" : isPvw ? "0 0 25px #50fa7b18" : "none",
              cursor: "pointer", WebkitTapHighlightColor: "transparent", userSelect: "none",
              position: "relative",
            }}>
              {isEditing ? (
                <input
                  autoFocus
                  value={newCamName}
                  onClick={e => e.stopPropagation()}
                  onChange={e => setNewCamName(e.target.value.toUpperCase())}
                  onKeyDown={e => { if (e.key === "Enter") renameCam(cam, newCamName); if (e.key === "Escape") setEditingCam(null); }}
                  onBlur={() => renameCam(cam, newCamName)}
                  style={{
                    width: "90%", padding: "6px 8px", border: "1px solid #50fa7b66",
                    background: "#08080e", color: "#fff", fontFamily: FF,
                    fontSize: "clamp(1.1rem, 5.5vw, 1.6rem)",
                    textAlign: "center", outline: "none", borderRadius: "4px",
                    fontWeight: 500, letterSpacing: "0.08em",
                  }}
                />
              ) : (
                <div style={{
                  fontFamily: FF, fontSize: "clamp(1.1rem, 5.5vw, 1.6rem)", color: nameFg,
                  letterSpacing: "0.08em", fontWeight: 500,
                }}>{camNames[cam] || cam.toUpperCase()}</div>
              )}

              <div style={{
                fontFamily: FF, fontSize: "0.55rem", color: statusFg,
                letterSpacing: "0.3em", marginTop: "6px",
                animation: isPgm ? "blink 1.2s ease-in-out infinite" : "none",
              }}>{isPgm ? t("tally_program") : isPvw ? t("tally_preview") : t("tally_off")}</div>

              <div style={{ display: "flex", gap: "4px", justifyContent: "center", marginTop: "12px" }}
                onClick={e => e.stopPropagation()}>
                <button onClick={() => { setEditingCam(cam); setNewCamName(camNames[cam] || cam); }} style={{
                  padding: "5px 10px", border: "1px solid #333", background: "transparent",
                  color: "#888", fontFamily: FF, fontSize: "0.55rem", borderRadius: "3px", cursor: "pointer",
                }}>✏️</button>
                <button onClick={() => forcePreview(cam)} style={{
                  flex: 1, padding: "5px 0",
                  border: `1.5px solid ${isPvw ? "#50fa7b" : "#333"}`,
                  background: isPvw ? "#50fa7b18" : "transparent",
                  color: isPvw ? "#50fa7b" : "#999", fontFamily: FF, fontSize: "0.55rem",
                  borderRadius: "3px", cursor: "pointer", letterSpacing: "0.08em",
                  fontWeight: isPvw ? 500 : 400,
                }}>{t("tally_pvw")}</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      <div style={{
        display: "flex", gap: "16px", justifyContent: "center", alignItems: "center",
        padding: "10px", borderTop: "1px solid #1a1a2e", marginTop: "2px",
      }}>
        {(() => {
          const pgm = Object.entries(tallies).find(([_, v]) => v === "program");
          const pvw = Object.entries(tallies).find(([_, v]) => v === "preview");
          return (
            <>
              <span style={{ fontFamily: FF, fontSize: "0.7rem", color: pgm ? "#ff5555" : "#555", letterSpacing: "0.08em", fontWeight: 500 }}>
                {t("tally_pgm")}: {pgm ? (camNames[pgm[0]] || pgm[0]) : "—"}
              </span>
              <span style={{ fontFamily: FF, fontSize: "0.7rem", color: pvw ? "#50fa7b" : "#555", letterSpacing: "0.08em", fontWeight: 500 }}>
                {t("tally_pvw")}: {pvw ? (camNames[pvw[0]] || pvw[0]) : "—"}
              </span>
              <span style={{ fontFamily: FF, fontSize: "0.55rem", color: "#666", letterSpacing: "0.08em" }}>
                {Object.keys(tallies).length} {t("tally_cam")}
              </span>
            </>
          );
        })()}
      </div>
    </div>
  );
}
