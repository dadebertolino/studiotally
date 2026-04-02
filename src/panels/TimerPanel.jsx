// src/panels/TimerPanel.jsx
import { useState } from "react";
import { FF, PRESETS } from "../styles/constants.js";
import { t } from "../i18n.js";
import { Btn, Card, TimerDigits } from "../components/UI.jsx";

export function TimerPanel({ mode, setMode, running, ms, cdTotal, setCdTotal, displayMs, timerColor, status, doStart, doPause, doReset }) {
  const [showCd, setShowCd] = useState(false);
  const [cM, setCM] = useState("");
  const [cS, setCS] = useState("");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Mode selector */}
      <div style={{ display: "flex" }}>
        {["stopwatch", "countdown"].map(md => (
          <button key={md} onClick={() => { if (!running) { setMode(md); doReset(); } }} style={{
            flex: 1, padding: "9px", border: `1px solid ${mode === md ? "#50fa7b44" : "#12121e"}`,
            background: mode === md ? "#50fa7b08" : "transparent", color: mode === md ? "#50fa7b" : "#444",
            fontFamily: FF, fontSize: "0.65rem", letterSpacing: "0.18em", cursor: "pointer", textTransform: "uppercase",
            borderRadius: md === "stopwatch" ? "4px 0 0 4px" : "0 4px 4px 0",
          }}>{md === "stopwatch" ? t("master_stopwatch") : t("master_countdown")}</button>
        ))}
      </div>

      {/* Status */}
      <div style={{ textAlign: "center", fontFamily: FF, color: timerColor, fontSize: "0.75rem", letterSpacing: "0.4em", animation: running ? "blink 2s infinite" : "none" }}>{status}</div>

      {/* Timer display */}
      <div style={{
        border: `2px solid ${timerColor}22`, borderRadius: "8px", padding: "20px 10px",
        background: "#0a0a0f", boxShadow: `0 0 35px ${timerColor}0a`,
        animation: mode === "countdown" && (cdTotal - ms) <= 30000 && (cdTotal - ms) > 0 && running ? "pulse-border 1s infinite" : "none",
      }}>
        <TimerDigits ms={displayMs} color={timerColor} />
      </div>

      {/* Countdown settings */}
      {mode === "countdown" && !running && ms === 0 && (
        <>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontFamily: FF, color: "#444", fontSize: "0.65rem" }}>{Math.floor(cdTotal / 60000)}m {Math.floor((cdTotal % 60000) / 1000)}s</span>
            <span onClick={() => setShowCd(!showCd)} style={{ fontFamily: FF, color: "#50fa7b66", fontSize: "0.65rem", marginLeft: "12px", cursor: "pointer", borderBottom: "1px solid #50fa7b22" }}>
              {showCd ? t("master_close") : t("master_edit")}
            </span>
          </div>
          {showCd && (
            <Card>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "5px", marginBottom: "8px" }}>
                {PRESETS.map(p => (
                  <button key={p.s} onClick={() => { doReset(); setCdTotal(p.s * 1000); setShowCd(false); }} style={{ padding: "8px", border: "1px solid #1a1a2e", background: "#08080e", color: "#888", fontFamily: FF, fontSize: "0.75rem", cursor: "pointer", borderRadius: "3px" }}>{p.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input type="number" placeholder="min" value={cM} onChange={e => setCM(e.target.value)} style={{ width: "50px", padding: "8px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "0.8rem", textAlign: "center", outline: "none", borderRadius: "3px" }} />
                <span style={{ color: "#333" }}>:</span>
                <input type="number" placeholder="sec" value={cS} onChange={e => setCS(e.target.value)} style={{ width: "50px", padding: "8px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "0.8rem", textAlign: "center", outline: "none", borderRadius: "3px" }} />
                <Btn small color="#50fa7b" onClick={() => { const tot = ((parseInt(cM)||0)*60+(parseInt(cS)||0))*1000; if(tot>0){doReset();setCdTotal(tot);setCM("");setCS("");setShowCd(false);} }}>OK</Btn>
              </div>
            </Card>
          )}
        </>
      )}

      {/* Controls */}
      <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
        {!running
          ? <Btn color="#50fa7b" filled onClick={doStart}>{ms > 0 ? t("master_resume") : t("master_start")}</Btn>
          : <Btn color="#ffb86c" onClick={doPause}>{t("master_pause")}</Btn>}
        <Btn color="#555" onClick={doReset}>{t("master_reset")}</Btn>
      </div>
    </div>
  );
}
