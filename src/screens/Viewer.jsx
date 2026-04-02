// src/screens/Viewer.jsx
import { useState, useEffect, useRef } from "react";
import { FF, TALLY, fmt } from "../styles/constants.js";
import { t } from "../i18n.js";
import { Btn, Badge, TimerDigits } from "../components/UI.jsx";
import { useFirebaseSync } from "../useFirebaseSync.js";
import { useWakeLock } from "../useWakeLock.js";

export function Viewer({ roomCode, onLeave }) {
  const { remote } = useFirebaseSync(roomCode, false);
  const [localMs, setLocalMs] = useState(0);
  const [viewMode, setViewMode] = useState(null);
  

  // Store latest remote in ref for interval access
  const remoteRef = useRef(null);
  useEffect(() => { remoteRef.current = remote; }, [remote]);

  useWakeLock(viewMode !== null);

  // Timer reconstruction interval
  useEffect(() => {
    const tick = () => {
      const r = remoteRef.current;
      if (!r) {
        return;
      }

      if (r.running && r.mst) {
        const elapsed = (r.saved || 0) + (Date.now() - r.mst);
        setLocalMs(elapsed);
      } else if (r.running && !r.mst) {
        // running but no mst — use ms directly
        setLocalMs(r.ms || 0);
      } else {
        setLocalMs(r.ms || 0);
      }
    };

    tick();
    const itv = setInterval(tick, 250);
    return () => clearInterval(itv);
  }, []);

  // ── LOADING ──
  if (!remote) return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "14px" }}>
      <div style={{ width: "28px", height: "28px", border: "2px solid #8be9fd33", borderTop: "2px solid #8be9fd", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
      <div style={{ fontFamily: FF, color: "#444", fontSize: "0.75rem", letterSpacing: "0.2em" }}>{t("viewer_waiting")}</div>
      <div style={{ fontFamily: FF, color: "#222", fontSize: "0.55rem" }}>{t("viewer_room")} {roomCode}</div>
      <Btn small color="#ff5555" onClick={onLeave}>{t("master_exit")}</Btn>
    </div>
  );

  const { mode, running, cdTotal, tallies, camNames: rNames } = remote;
  const displayMs = mode === "countdown" ? Math.max(0, cdTotal - localMs) : localMs;
  const rem = mode === "countdown" ? cdTotal - localMs : null;
  const timerColor = mode === "stopwatch"
    ? (running ? "#ff5555" : localMs > 0 ? "#ffb86c" : "#50fa7b")
    : (rem <= 0 ? "#ff5555" : rem <= 30000 ? "#ffb86c" : rem <= 60000 ? "#f1fa8c" : "#50fa7b");
  const timerStatus = mode === "stopwatch"
    ? (running ? t("master_on_air") : localMs > 0 ? t("master_paused") : t("viewer_standby"))
    : (rem <= 0 ? t("master_time_up") : running ? "● COUNTDOWN" : localMs > 0 ? t("master_paused") : t("viewer_standby"));
  const tf = fmt(displayMs);
  const timerStr = `${tf.h}:${tf.m}:${tf.s}`;

  // ── MODE SELECTION ──
  if (viewMode === null && tallies) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <div className="safe-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #12121e" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Badge color="#8be9fd">{t("lobby_role_viewer")}</Badge>
            <span style={{ fontFamily: FF, color: "#8be9fd66", fontSize: "0.75rem", letterSpacing: "0.25em" }}>{roomCode}</span>
          </div>
          <Btn small color="#ff555555" onClick={onLeave}>{t("master_exit")}</Btn>
        </div>
        <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "16px" }}>
          <div style={{ fontFamily: FF, fontSize: "0.9rem", color: "#eee", letterSpacing: "0.15em", marginBottom: "4px" }}>{t("viewer_what_to_see")}</div>
          <div style={{ fontFamily: FF, fontSize: "0.55rem", color: "#555", letterSpacing: "0.08em", textAlign: "center", marginBottom: "12px" }}>
            {t("viewer_what_desc")}
          </div>

          <button onClick={() => setViewMode("all")} style={{
            width: "min(90vw, 340px)", padding: "18px 20px",
            border: "2px solid #8be9fd44", borderRadius: "8px", background: "#0c0c16",
            cursor: "pointer", textAlign: "left", WebkitTapHighlightColor: "transparent",
          }}>
            <div style={{ fontFamily: FF, fontSize: "1rem", color: "#8be9fd", letterSpacing: "0.1em", fontWeight: 500 }}>{t("viewer_all_cameras")}</div>
            <div style={{ fontFamily: FF, fontSize: "0.55rem", color: "#555", marginTop: "4px" }}>{t("viewer_all_desc")}</div>
          </button>

          <div style={{ fontFamily: FF, fontSize: "0.45rem", color: "#444", letterSpacing: "0.3em", marginTop: "8px" }}>{t("viewer_single_cam")}</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", width: "min(90vw, 340px)" }}>
            {Object.entries(tallies).map(([cam, st]) => {
              const isPgm = st === "program";
              const isPvw = st === "preview";
              return (
                <button key={cam} onClick={() => setViewMode(cam)} style={{
                  padding: "16px 10px", border: `2px solid ${isPgm ? "#ff5555" : isPvw ? "#50fa7b88" : "#252530"}`,
                  borderRadius: "8px", background: isPgm ? "#1a0808" : isPvw ? "#081a08" : "#0c0c16",
                  cursor: "pointer", textAlign: "center", WebkitTapHighlightColor: "transparent",
                }}>
                  <div style={{ fontFamily: FF, fontSize: "0.9rem", color: "#ddd", letterSpacing: "0.08em", fontWeight: 500 }}>
                    {rNames?.[cam] || cam.toUpperCase().replace("CAM", "CAM ")}
                  </div>
                  <div style={{ fontFamily: FF, fontSize: "0.5rem", marginTop: "4px", letterSpacing: "0.2em", color: isPgm ? "#ff5555" : isPvw ? "#50fa7b" : "#444" }}>
                    {isPgm ? "● PGM" : isPvw ? "● PVW" : "OFF"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── FULLSCREEN SINGLE CAMERA ──
  if (viewMode && viewMode !== "all" && tallies) {
    const cam = viewMode;
    const st = tallies[cam] || "off";
    const isPgm = st === "program";
    const isPvw = st === "preview";
    const fullColor = isPgm ? "#ff5555" : isPvw ? "#50fa7b" : "#555";
    const fullLabel = isPgm ? t("tally_program").replace("● ", "") : isPvw ? t("tally_preview").replace("● ", "") : t("viewer_off_air");
    const camName = rNames?.[cam] || cam.toUpperCase().replace("CAM", "CAM ");

    return (
      <div style={{
        minHeight: "100vh", background: isPgm ? "#1a0000" : isPvw ? "#001a00" : "#0a0a0f",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        position: "relative", border: `4px solid ${fullColor}`, transition: "all 0.3s ease",
      }}>
        <div className="safe-top" style={{ position: "absolute", top: 0, left: 0, right: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px" }}>
          <Badge color="#8be9fd">{roomCode}</Badge>
          <button onClick={() => setViewMode(null)} style={{ padding: "6px 12px", border: "1px solid #ffffff22", borderRadius: "4px", background: "transparent", color: "#888", fontFamily: FF, fontSize: "0.55rem", cursor: "pointer", letterSpacing: "0.1em" }}>
            {t("viewer_change")}
          </button>
        </div>

        <div style={{
          width: isPgm ? "20px" : "14px", height: isPgm ? "20px" : "14px",
          borderRadius: "50%", background: fullColor,
          boxShadow: st !== "off" ? `0 0 20px ${fullColor}, 0 0 60px ${fullColor}44` : "none",
          animation: isPgm ? "blink 1s ease-in-out infinite" : "none", marginBottom: "20px",
        }} />

        <div style={{
          fontFamily: FF, fontSize: "clamp(2.5rem, 14vw, 6rem)", color: "#fff",
          letterSpacing: "0.08em", fontWeight: 500, textAlign: "center",
          textShadow: st !== "off" ? `0 0 40px ${fullColor}33` : "none", padding: "0 20px",
        }}>{camName}</div>

        <div style={{ fontFamily: FF, fontSize: "clamp(0.9rem, 4vw, 1.4rem)", color: fullColor, letterSpacing: "0.4em", marginTop: "12px", fontWeight: 500 }}>
          {fullLabel}
        </div>

        <div style={{
          position: "absolute", bottom: "0", left: "0", right: "0",
          padding: "14px", display: "flex", justifyContent: "space-between", alignItems: "center",
          borderTop: `1px solid ${fullColor}22`, background: "##00000044",
        }}>
          <div style={{ fontFamily: FF, fontSize: "0.55rem", color: timerColor, letterSpacing: "0.2em", animation: running ? "blink 2s infinite" : "none" }}>
            {timerStatus}
          </div>
          <div style={{ fontFamily: FF, fontSize: "clamp(1rem, 4vw, 1.5rem)", color: timerColor, letterSpacing: "0.08em", fontWeight: 500, textShadow: `0 0 15px ${timerColor}22` }}>
            {timerStr}
          </div>
        </div>

        {mode === "countdown" && rem <= 0 && !running && localMs > 0 && (
          <div style={{ position: "fixed", top: "4px", left: "4px", right: "4px", padding: "10px", background: "#ff555533", border: "2px solid #ff5555", borderRadius: "6px", textAlign: "center", fontFamily: FF, color: "#ff5555", fontSize: "0.85rem", letterSpacing: "0.35em", animation: "blink 1s infinite", zIndex: 100 }}>
            {t("master_time_up")}
          </div>
        )}
      </div>
    );
  }

  // ── ALL CAMERAS OVERVIEW ──
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div className="safe-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #12121e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Badge color="#8be9fd">{t("lobby_role_viewer")}</Badge>
          <span style={{ fontFamily: FF, color: "#8be9fd66", fontSize: "0.75rem", letterSpacing: "0.25em" }}>{roomCode}</span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={() => setViewMode(null)} style={{ padding: "5px 10px", border: "1px solid #333", borderRadius: "3px", background: "transparent", color: "#888", fontFamily: FF, fontSize: "0.5rem", cursor: "pointer", letterSpacing: "0.1em" }}>
            {t("viewer_change")}
          </button>
          <Btn small color="#ff555555" onClick={onLeave}>{t("master_exit")}</Btn>
        </div>
      </div>
      <div style={{ flex: 1, padding: "12px", display: "flex", flexDirection: "column", gap: "12px" }}>
        <div style={{ textAlign: "center", fontFamily: FF, color: timerColor, fontSize: "0.8rem", letterSpacing: "0.4em", animation: running ? "blink 2s infinite" : "none" }}>{timerStatus}</div>
        <div style={{
          border: `2px solid ${timerColor}22`, borderRadius: "8px", padding: "24px 12px",
          background: "#0a0a0f", boxShadow: `0 0 45px ${timerColor}0b`,
          animation: mode === "countdown" && rem <= 30000 && rem > 0 && running ? "pulse-border 1s infinite" : "none",
        }}>
          <TimerDigits ms={displayMs} color={timerColor} />
        </div>
        {tallies && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            {Object.entries(tallies).map(([cam, st]) => {
              const isPgm = st === "program";
              const isPvw = st === "preview";
              return (
                <div key={cam} onClick={() => setViewMode(cam)} style={{
                  background: isPgm ? "#2a0808" : isPvw ? "#082a08" : "#0e0e18",
                  border: `2px solid ${isPgm ? "#ff5555" : isPvw ? "#50fa7b88" : "#252530"}`,
                  borderRadius: "8px", padding: "18px 10px", textAlign: "center", cursor: "pointer",
                  boxShadow: isPgm ? "0 0 25px #ff555520" : isPvw ? "0 0 20px #50fa7b15" : "none",
                  WebkitTapHighlightColor: "transparent",
                }}>
                  <div style={{ fontFamily: FF, fontSize: "clamp(0.9rem, 4vw, 1.3rem)", color: isPgm ? "#fff" : isPvw ? "#e0ffe0" : "#ddd", letterSpacing: "0.08em", fontWeight: 500 }}>
                    {rNames?.[cam] || cam.toUpperCase().replace("CAM", "CAM ")}
                  </div>
                  <div style={{
                    fontFamily: FF, fontSize: "0.5rem", color: isPgm ? "#ff5555" : isPvw ? "#50fa7b" : "#666",
                    letterSpacing: "0.25em", marginTop: "5px",
                    animation: isPgm ? "blink 1.2s infinite" : "none",
                  }}>{isPgm ? t("tally_program") : isPvw ? t("tally_preview") : t("tally_off")}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      {mode === "countdown" && rem <= 0 && !running && localMs > 0 && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, padding: "8px", background: "#ff555528", borderBottom: "2px solid #ff5555", textAlign: "center", fontFamily: FF, color: "#ff5555", fontSize: "0.8rem", letterSpacing: "0.3em", animation: "blink 1s infinite", zIndex: 100 }}>
          {t("master_time_up")}
        </div>
      )}
    </div>
  );
}
