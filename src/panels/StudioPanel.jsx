// src/panels/StudioPanel.jsx — Unified: Show Clock + Segment Timer + Tally + Cam Timers + Messages
import { useState } from "react";
import { FF, PRESETS, fmt } from "../styles/constants.js";
import { t } from "../i18n.js";
import { Btn, Badge, Card, TimerDigits } from "../components/UI.jsx";

const CAM_TIMER_PRESETS = [
  { label: "1m", s: 60 }, { label: "2m", s: 120 }, { label: "3m", s: 180 }, { label: "5m", s: 300 },
];
const MSG_PRESETS = ["STRINGI", "ALLARGA", "30 SEC", "1 MIN", "CHIUDI", "STAND BY", "VAI", "MUOVITI"];

export function StudioPanel({
  // Show clock
  showClock, onShowClockStart, onShowClockPause, onShowClockReset,
  // Segment timer
  mode, setMode, running, ms, cdTotal, setCdTotal, displayMs, timerColor, status,
  doStart, doPause, doReset,
  // Tally
  tallies, setTallies, camNames, setCamNames, bridgeRef, sendToBridge,
  bridgeActive, onBridgeCommand,
  // Cam timers
  camTimers, onCamTimerStart, onCamTimerStop,
  // Messages
  messages, onSendMessage, onClearMessage,
}) {
  const [showCd, setShowCd] = useState(false);
  const [cM, setCM] = useState("");
  const [cS, setCS] = useState("");
  const [editingCam, setEditingCam] = useState(null);
  const [newCamName, setNewCamName] = useState("");
  const [expandedCam, setExpandedCam] = useState(null); // which cam has expanded panel
  const [expandedMode, setExpandedMode] = useState(null); // "timer" | "msg"
  const [msgText, setMsgText] = useState("");
  const [customM, setCustomM] = useState("");
  const [customS, setCustomS] = useState("");
  // Multi-message
  const [multiMsg, setMultiMsg] = useState(false);
  const [multiTargets, setMultiTargets] = useState({});
  const [multiText, setMultiText] = useState("");

  // Show clock display
  const scMs = showClock?.running && showClock?.mst
    ? (showClock.saved || 0) + (Date.now() - showClock.mst)
    : (showClock?.saved || 0);
  const scColor = showClock?.running ? "#8be9fd" : scMs > 0 ? "#ffb86c" : "#555";

  // Camera helpers
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
  const renameCam = (cam, name) => { setCamNames(p => ({ ...p, [cam]: name || cam.toUpperCase() })); setEditingCam(null); };
  const tapCamera = (cam) => {
    setTallies(p => {
      const cur = p[cam]; const n = {};
      if (cur === "off") {
        Object.keys(p).forEach(k => { n[k] = k === cam ? "preview" : p[k] === "preview" ? "off" : p[k]; });
        sendToBridge(cam, "preview");
        const camNum = parseInt(cam.replace("cam", ""));
        if (onBridgeCommand && !isNaN(camNum)) onBridgeCommand("PreviewInput", { Input: String(camNum) });
      }
      else if (cur === "preview") {
        Object.keys(p).forEach(k => { n[k] = k === cam ? "program" : p[k] === "program" ? "preview" : (p[k] === "preview" && k !== cam) ? "off" : p[k]; });
        sendToBridge(cam, "program");
        if (onBridgeCommand) onBridgeCommand("Cut");
      }
      else if (cur === "program") {
        const pvw = Object.entries(p).find(([k, v]) => v === "preview");
        Object.keys(p).forEach(k => { n[k] = k === cam ? "off" : (pvw && k === pvw[0]) ? "program" : p[k]; });
        if (pvw) { sendToBridge(pvw[0], "program"); if (onBridgeCommand) onBridgeCommand("Cut"); }
      }
      return n;
    });
  };
  const forcePreview = (cam) => {
    setTallies(p => { const n = {}; Object.keys(p).forEach(k => { n[k] = k === cam ? "preview" : p[k] === "preview" ? "off" : p[k]; }); return n; });
    sendToBridge(cam, "preview");
    const camNum = parseInt(cam.replace("cam", ""));
    if (onBridgeCommand && !isNaN(camNum)) onBridgeCommand("PreviewInput", { Input: String(camNum) });
  };
  const getCamTimerDisplay = (cam) => {
    const ct = camTimers?.[cam]; if (!ct || !ct.total) return null;
    let elapsed = ct.saved || 0; if (ct.running && ct.mst) elapsed += Date.now() - ct.mst;
    return { remaining: Math.max(0, ct.total - elapsed), expired: ct.total - elapsed <= 0, running: ct.running };
  };

  const toggleExpand = (cam, mode) => {
    if (expandedCam === cam && expandedMode === mode) { setExpandedCam(null); setExpandedMode(null); }
    else { setExpandedCam(cam); setExpandedMode(mode); }
  };

  // Send multi-message
  const sendMulti = (text) => {
    Object.keys(multiTargets).filter(k => multiTargets[k]).forEach(cam => onSendMessage(cam, text));
    setMultiMsg(false); setMultiTargets({}); setMultiText("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>

      {/* ═══ SHOW CLOCK — compact bar ═══ */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", border: "1px solid #1a1a2e", borderRadius: "6px", background: "#0c0c16" }}>
        <div style={{ fontFamily: FF, fontSize: "0.45rem", color: "#8be9fd", letterSpacing: "0.2em", minWidth: "38px" }}>SHOW</div>
        <div style={{ flex: 1, fontFamily: FF, fontSize: "clamp(0.9rem, 4vw, 1.3rem)", color: scColor, letterSpacing: "0.05em", fontWeight: 500 }}>
          {(() => { const f = fmt(scMs); return `${f.h}:${f.m}:${f.s}`; })()}
        </div>
        {!showClock?.running
          ? <Btn small color="#8be9fd" onClick={onShowClockStart} style={{ padding: "5px 10px", fontSize: "0.55rem" }}>{scMs > 0 ? "▶" : "▶ GO"}</Btn>
          : <Btn small color="#ffb86c" onClick={onShowClockPause} style={{ padding: "5px 10px", fontSize: "0.55rem" }}>⏸</Btn>}
        <Btn small color="#555" onClick={onShowClockReset} style={{ padding: "5px 8px", fontSize: "0.55rem" }}>↺</Btn>
      </div>

      {/* ═══ SEGMENT TIMER — compact ═══ */}
      <div style={{ border: "1px solid #1a1a2e", borderRadius: "6px", padding: "10px", background: "#0c0c16" }}>
        <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
          {["stopwatch", "countdown"].map(md => (
            <button key={md} onClick={() => { if (!running) { setMode(md); doReset(); } }} style={{
              flex: 1, padding: "6px", border: `1px solid ${mode === md ? "#50fa7b44" : "#12121e"}`,
              background: mode === md ? "#50fa7b08" : "transparent", color: mode === md ? "#50fa7b" : "#444",
              fontFamily: FF, fontSize: "0.55rem", letterSpacing: "0.12em", cursor: "pointer", textTransform: "uppercase",
              borderRadius: md === "stopwatch" ? "4px 0 0 4px" : "0 4px 4px 0",
            }}>{md === "stopwatch" ? t("master_stopwatch") : t("master_countdown")}</button>
          ))}
        </div>

        <div style={{ textAlign: "center", fontFamily: FF, color: timerColor, fontSize: "0.6rem", letterSpacing: "0.3em", marginBottom: "4px", animation: running ? "blink 2s infinite" : "none" }}>{status}</div>

        <div style={{ border: `1.5px solid ${timerColor}22`, borderRadius: "6px", padding: "12px 8px", background: "#0a0a0f", boxShadow: `0 0 25px ${timerColor}08`, marginBottom: "8px", animation: mode === "countdown" && (cdTotal - ms) <= 30000 && (cdTotal - ms) > 0 && running ? "pulse-border 1s infinite" : "none" }}>
          <TimerDigits ms={displayMs} color={timerColor} />
        </div>

        {/* Countdown settings */}
        {mode === "countdown" && !running && ms === 0 && (
          <div style={{ marginBottom: "8px" }}>
            <div style={{ textAlign: "center", marginBottom: "6px" }}>
              <span style={{ fontFamily: FF, color: "#444", fontSize: "0.6rem" }}>{Math.floor(cdTotal / 60000)}m {Math.floor((cdTotal % 60000) / 1000)}s</span>
              <span onClick={() => setShowCd(!showCd)} style={{ fontFamily: FF, color: "#50fa7b66", fontSize: "0.6rem", marginLeft: "10px", cursor: "pointer", borderBottom: "1px solid #50fa7b22" }}>
                {showCd ? t("master_close") : t("master_edit")}
              </span>
            </div>
            {showCd && (
              <Card style={{ padding: "8px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px", marginBottom: "6px" }}>
                  {PRESETS.map(p => (
                    <button key={p.s} onClick={() => { doReset(); setCdTotal(p.s * 1000); setShowCd(false); }} style={{ padding: "6px", border: "1px solid #1a1a2e", background: "#08080e", color: "#888", fontFamily: FF, fontSize: "0.65rem", cursor: "pointer", borderRadius: "3px" }}>{p.label}</button>
                  ))}
                </div>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <input type="number" placeholder="m" value={cM} onChange={e => setCM(e.target.value)} style={{ width: "40px", padding: "6px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "0.7rem", textAlign: "center", outline: "none", borderRadius: "3px" }} />
                  <span style={{ color: "#333" }}>:</span>
                  <input type="number" placeholder="s" value={cS} onChange={e => setCS(e.target.value)} style={{ width: "40px", padding: "6px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "0.7rem", textAlign: "center", outline: "none", borderRadius: "3px" }} />
                  <Btn small color="#50fa7b" onClick={() => { const tot = ((parseInt(cM)||0)*60+(parseInt(cS)||0))*1000; if(tot>0){doReset();setCdTotal(tot);setCM("");setCS("");setShowCd(false);} }} style={{ padding: "5px 10px", fontSize: "0.55rem" }}>OK</Btn>
                </div>
              </Card>
            )}
          </div>
        )}

        <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
          {!running
            ? <Btn small color="#50fa7b" filled onClick={doStart}>{ms > 0 ? t("master_resume") : t("master_start")}</Btn>
            : <Btn small color="#ffb86c" onClick={doPause}>{t("master_pause")}</Btn>}
          <Btn small color="#555" onClick={doReset}>{t("master_reset")}</Btn>
        </div>
      </div>

      {/* ═══ TRANSITIONS ═══ */}
      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
        {[
          { label: "CUT", color: "#ff5555", cmd: "Cut" },
          { label: "FADE", color: "#ffb86c", cmd: "Fade" },
          { label: "FTB", color: "#ff5555", cmd: "FadeToBlack" },
          { label: "DIP", color: "#8be9fd", cmd: "Transition3" },
          { label: "WIPE", color: "#8be9fd", cmd: "Transition4" },
        ].map(tr => (
          <button key={tr.cmd} onClick={() => {
            if (tr.cmd === "FadeToBlack") { setTallies(p => Object.fromEntries(Object.keys(p).map(k => [k, "off"]))); }
            else { setTallies(p => { const pvw = Object.entries(p).find(([_, v]) => v === "preview"); if (!pvw) return p; const n = {}; Object.keys(p).forEach(k => { n[k] = k === pvw[0] ? "program" : p[k] === "program" ? "preview" : p[k]; }); return n; }); }
            if (bridgeRef) { try { bridgeRef.sendCommand(tr.cmd); } catch(e) {} }
            if (onBridgeCommand) onBridgeCommand(tr.cmd);
          }} style={{
            flex: (tr.label === "CUT" || tr.label === "FADE") ? "1" : "none",
            minWidth: (tr.label === "CUT" || tr.label === "FADE") ? "0" : "46px",
            padding: "8px 10px", border: `1.5px solid ${tr.color}55`, background: `${tr.color}08`, color: tr.color,
            fontFamily: FF, fontSize: "0.65rem", fontWeight: 500, borderRadius: "4px", cursor: "pointer", letterSpacing: "0.08em",
            WebkitTapHighlightColor: "transparent",
          }}>{tr.label}</button>
        ))}
      </div>

      {/* ═══ CAMERA TOOLBAR ═══ */}
      <div style={{ display: "flex", gap: "5px", alignItems: "center" }}>
        <Btn small color="#50fa7b" onClick={addCamera} style={{ padding: "5px 10px", fontSize: "0.55rem" }}>+ CAM</Btn>
        <Btn small color="#ff5555" disabled={Object.keys(tallies).length <= 1} onClick={removeCamera} style={{ padding: "5px 10px", fontSize: "0.55rem" }}>− CAM</Btn>
        <div style={{ flex: 1 }} />
        {bridgeRef && <Badge color="#8be9fd">BRIDGE</Badge>}
        <Btn small color="#ffb86c" onClick={() => { setMultiMsg(!multiMsg); setMultiTargets({}); }} style={{ padding: "5px 10px", fontSize: "0.55rem" }}>💬 MULTI</Btn>
        <Btn small color="#888" onClick={() => setTallies(p => Object.fromEntries(Object.keys(p).map(k => [k, "off"])))} style={{ padding: "5px 10px", fontSize: "0.55rem" }}>ALL OFF</Btn>
      </div>

      {/* ═══ MULTI-MESSAGE PANEL ═══ */}
      {multiMsg && (
        <Card style={{ padding: "10px", border: "1px solid #ffb86c33" }}>
          <div style={{ fontFamily: FF, fontSize: "0.45rem", color: "#ffb86c", letterSpacing: "0.2em", marginBottom: "6px" }}>MESSAGGIO A PIÙ CAMERE</div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "8px" }}>
            {Object.keys(tallies).map(cam => (
              <button key={cam} onClick={() => setMultiTargets(p => ({ ...p, [cam]: !p[cam] }))} style={{
                padding: "5px 10px", border: `1.5px solid ${multiTargets[cam] ? "#ffb86c" : "#333"}`,
                background: multiTargets[cam] ? "#ffb86c18" : "transparent",
                color: multiTargets[cam] ? "#ffb86c" : "#888",
                fontFamily: FF, fontSize: "0.55rem", borderRadius: "4px", cursor: "pointer",
              }}>{camNames[cam] || cam}</button>
            ))}
            <button onClick={() => { const all = {}; Object.keys(tallies).forEach(k => all[k] = true); setMultiTargets(all); }} style={{
              padding: "5px 10px", border: "1px solid #ffb86c44", background: "#ffb86c0a", color: "#ffb86c",
              fontFamily: FF, fontSize: "0.5rem", borderRadius: "4px", cursor: "pointer", letterSpacing: "0.08em",
            }}>TUTTE</button>
          </div>
          <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", marginBottom: "6px" }}>
            {MSG_PRESETS.map(m => (
              <button key={m} onClick={() => sendMulti(m)} style={{ padding: "4px 7px", border: "1px solid #ffb86c44", background: "#ffb86c0a", color: "#ffb86c", fontFamily: FF, fontSize: "0.5rem", borderRadius: "3px", cursor: "pointer" }}>{m}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: "4px" }}>
            <input value={multiText} onChange={e => setMultiText(e.target.value.toUpperCase())} placeholder="MESSAGGIO..." style={{ flex: 1, padding: "6px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "0.6rem", outline: "none", borderRadius: "3px" }} />
            <Btn small color="#ffb86c" onClick={() => { if (multiText.trim()) sendMulti(multiText.trim()); }} style={{ padding: "5px 10px", fontSize: "0.5rem" }}>▶</Btn>
          </div>
          {/* Clear all messages */}
          <div style={{ marginTop: "6px", textAlign: "right" }}>
            <Btn small color="#555" onClick={() => { Object.keys(tallies).forEach(cam => onClearMessage(cam)); }} style={{ padding: "4px 10px", fontSize: "0.45rem" }}>CANCELLA TUTTI I MSG</Btn>
          </div>
        </Card>
      )}

      {/* ═══ CAMERA GRID ═══ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {Object.entries(tallies).map(([cam, st]) => {
          const isPgm = st === "program"; const isPvw = st === "preview";
          const isEditing = editingCam === cam;
          const cardBg = isPgm ? "#2a0808" : isPvw ? "#082a08" : "#0e0e18";
          const cardBorder = isPgm ? "#ff5555" : isPvw ? "#50fa7b88" : "#252530";
          const nameFg = isPgm ? "#fff" : isPvw ? "#e0ffe0" : "#ddd";
          const statusFg = isPgm ? "#ff5555" : isPvw ? "#50fa7b" : "#666";
          const ctd = getCamTimerDisplay(cam);
          const msg = messages?.[cam];
          const isExpanded = expandedCam === cam;

          return (
            <div key={cam} style={{
              background: cardBg, border: `2.5px solid ${cardBorder}`, borderRadius: "8px",
              padding: "12px 8px 8px", textAlign: "center", transition: "all 0.15s",
              boxShadow: isPgm ? "0 0 30px #ff555525" : isPvw ? "0 0 25px #50fa7b18" : "none",
              userSelect: "none", position: "relative",
            }}>
              {/* Name + tally (tappable) */}
              <div onClick={() => { if (!isEditing) tapCamera(cam); }} style={{ cursor: "pointer", WebkitTapHighlightColor: "transparent" }}>
                {isEditing ? (
                  <input autoFocus value={newCamName} onClick={e => e.stopPropagation()}
                    onChange={e => setNewCamName(e.target.value.toUpperCase())}
                    onKeyDown={e => { if (e.key === "Enter") renameCam(cam, newCamName); if (e.key === "Escape") setEditingCam(null); }}
                    onBlur={() => renameCam(cam, newCamName)}
                    style={{ width: "90%", padding: "3px 6px", border: "1px solid #50fa7b66", background: "#08080e", color: "#fff", fontFamily: FF, fontSize: "clamp(0.85rem, 4vw, 1.2rem)", textAlign: "center", outline: "none", borderRadius: "4px", fontWeight: 500 }}
                  />
                ) : (
                  <div style={{ fontFamily: FF, fontSize: "clamp(0.85rem, 4vw, 1.2rem)", color: nameFg, letterSpacing: "0.06em", fontWeight: 500 }}>{camNames[cam] || cam.toUpperCase()}</div>
                )}
                <div style={{ fontFamily: FF, fontSize: "0.48rem", color: statusFg, letterSpacing: "0.25em", marginTop: "3px", animation: isPgm ? "blink 1.2s ease-in-out infinite" : "none" }}>
                  {isPgm ? "● PROGRAM" : isPvw ? "● PREVIEW" : "—"}
                </div>
              </div>

              {/* Camera countdown */}
              {ctd && (
                <div style={{ marginTop: "4px" }}>
                  <span style={{ fontFamily: FF, fontSize: "clamp(0.75rem, 3vw, 1rem)", color: ctd.expired ? "#ff5555" : ctd.remaining <= 30000 ? "#ffb86c" : "#f1fa8c", animation: ctd.expired ? "blink 1s infinite" : "none" }}>
                    {(() => { const f = fmt(ctd.remaining); return `${f.m}:${f.s}`; })()}
                  </span>
                </div>
              )}

              {/* Active message + clear button */}
              {msg?.text && (
                <div style={{ marginTop: "4px", padding: "3px 6px", background: "#ffb86c18", border: "1px solid #ffb86c44", borderRadius: "3px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
                  <span style={{ fontFamily: FF, fontSize: "0.5rem", color: "#ffb86c", animation: "blink 2s infinite", flex: 1 }}>{msg.text}</span>
                  <button onClick={(e) => { e.stopPropagation(); onClearMessage(cam); }} style={{ padding: "1px 5px", border: "1px solid #ffb86c44", background: "transparent", color: "#ffb86c88", fontFamily: FF, fontSize: "0.45rem", borderRadius: "2px", cursor: "pointer", lineHeight: 1 }}>✕</button>
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "3px", justifyContent: "center", marginTop: "6px" }} onClick={e => e.stopPropagation()}>
                <button onClick={() => { setEditingCam(cam); setNewCamName(camNames[cam] || cam); }} style={{ padding: "4px 7px", border: "1px solid #333", background: "transparent", color: "#888", fontFamily: FF, fontSize: "0.48rem", borderRadius: "3px", cursor: "pointer" }}>✏️</button>
                <button onClick={() => forcePreview(cam)} style={{ padding: "4px 7px", border: `1px solid ${isPvw ? "#50fa7b" : "#333"}`, background: isPvw ? "#50fa7b18" : "transparent", color: isPvw ? "#50fa7b" : "#999", fontFamily: FF, fontSize: "0.48rem", borderRadius: "3px", cursor: "pointer" }}>PVW</button>
                <button onClick={() => toggleExpand(cam, "timer")} style={{ padding: "4px 7px", border: `1px solid ${isExpanded && expandedMode === "timer" ? "#f1fa8c" : "#333"}`, background: isExpanded && expandedMode === "timer" ? "#f1fa8c18" : "transparent", color: isExpanded && expandedMode === "timer" ? "#f1fa8c" : "#999", fontFamily: FF, fontSize: "0.48rem", borderRadius: "3px", cursor: "pointer" }}>⏱</button>
                <button onClick={() => toggleExpand(cam, "msg")} style={{ padding: "4px 7px", border: `1px solid ${isExpanded && expandedMode === "msg" ? "#ffb86c" : "#333"}`, background: isExpanded && expandedMode === "msg" ? "#ffb86c18" : "transparent", color: isExpanded && expandedMode === "msg" ? "#ffb86c" : "#999", fontFamily: FF, fontSize: "0.48rem", borderRadius: "3px", cursor: "pointer" }}>💬</button>
              </div>

              {/* Expanded: timer */}
              {isExpanded && expandedMode === "timer" && (
                <div style={{ marginTop: "6px", padding: "6px", borderTop: "1px solid #1a1a2e" }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", marginBottom: "4px" }}>
                    {CAM_TIMER_PRESETS.map(p => (
                      <button key={p.s} onClick={() => { onCamTimerStart(cam, p.s * 1000); setExpandedCam(null); }} style={{ padding: "4px 7px", border: "1px solid #f1fa8c44", background: "#f1fa8c0a", color: "#f1fa8c", fontFamily: FF, fontSize: "0.5rem", borderRadius: "3px", cursor: "pointer" }}>{p.label}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                    <input type="number" placeholder="m" value={customM} onChange={e => setCustomM(e.target.value)} style={{ width: "30px", padding: "3px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "0.55rem", textAlign: "center", outline: "none", borderRadius: "3px" }} />
                    <span style={{ color: "#333", fontSize: "0.55rem" }}>:</span>
                    <input type="number" placeholder="s" value={customS} onChange={e => setCustomS(e.target.value)} style={{ width: "30px", padding: "3px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "0.55rem", textAlign: "center", outline: "none", borderRadius: "3px" }} />
                    <Btn small color="#f1fa8c" onClick={() => { const tot = ((parseInt(customM)||0)*60+(parseInt(customS)||0))*1000; if(tot>0){ onCamTimerStart(cam, tot); setCustomM(""); setCustomS(""); setExpandedCam(null); } }} style={{ padding: "3px 7px", fontSize: "0.48rem" }}>▶</Btn>
                  </div>
                  {ctd && <button onClick={() => onCamTimerStop(cam)} style={{ marginTop: "4px", padding: "3px 8px", border: "1px solid #555", background: "transparent", color: "#888", fontFamily: FF, fontSize: "0.45rem", borderRadius: "3px", cursor: "pointer" }}>STOP TIMER</button>}
                </div>
              )}

              {/* Expanded: message */}
              {isExpanded && expandedMode === "msg" && (
                <div style={{ marginTop: "6px", padding: "6px", borderTop: "1px solid #1a1a2e" }} onClick={e => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: "3px", flexWrap: "wrap", marginBottom: "4px" }}>
                    {MSG_PRESETS.map(m => (
                      <button key={m} onClick={() => { onSendMessage(cam, m); setExpandedCam(null); }} style={{ padding: "3px 6px", border: "1px solid #ffb86c44", background: "#ffb86c0a", color: "#ffb86c", fontFamily: FF, fontSize: "0.48rem", borderRadius: "3px", cursor: "pointer" }}>{m}</button>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "3px" }}>
                    <input value={msgText} onChange={e => setMsgText(e.target.value.toUpperCase())} placeholder="MSG..." style={{ flex: 1, padding: "4px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "0.5rem", outline: "none", borderRadius: "3px" }} />
                    <Btn small color="#ffb86c" onClick={() => { if (msgText.trim()) { onSendMessage(cam, msgText.trim()); setMsgText(""); setExpandedCam(null); } }} style={{ padding: "3px 7px", fontSize: "0.48rem" }}>▶</Btn>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div style={{ display: "flex", gap: "12px", justifyContent: "center", alignItems: "center", padding: "8px", borderTop: "1px solid #1a1a2e" }}>
        {(() => {
          const pgm = Object.entries(tallies).find(([_, v]) => v === "program");
          const pvw = Object.entries(tallies).find(([_, v]) => v === "preview");
          return (<>
            <span style={{ fontFamily: FF, fontSize: "0.65rem", color: pgm ? "#ff5555" : "#555", letterSpacing: "0.06em", fontWeight: 500 }}>PGM: {pgm ? (camNames[pgm[0]] || pgm[0]) : "—"}</span>
            <span style={{ fontFamily: FF, fontSize: "0.65rem", color: pvw ? "#50fa7b" : "#555", letterSpacing: "0.06em", fontWeight: 500 }}>PVW: {pvw ? (camNames[pvw[0]] || pvw[0]) : "—"}</span>
            <span style={{ fontFamily: FF, fontSize: "0.5rem", color: "#666" }}>{Object.keys(tallies).length} cam</span>
          </>);
        })()}
      </div>
    </div>
  );
}
