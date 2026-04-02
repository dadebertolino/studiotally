// src/screens/Master.jsx
import { useState, useEffect, useRef, useCallback } from "react";
import { FF } from "../styles/constants.js";
import { t } from "../i18n.js";
import { Btn, Badge } from "../components/UI.jsx";
import { useFirebaseSync } from "../useFirebaseSync.js";
import { useWakeLock } from "../useWakeLock.js";
import { TimerPanel } from "../panels/TimerPanel.jsx";
import { TallyPanel } from "../panels/TallyPanel.jsx";
import { BridgePanel } from "../panels/BridgePanel.jsx";
import { getRoomMeta, extendRoom, destroyRoom, ROOM_TTL_PRESETS } from "../firebase-config.js";

export function Master({ roomCode, onLeave }) {
  const [mode, setMode] = useState("stopwatch");
  const [running, setRunning] = useState(false);
  const [ms, setMs] = useState(0);
  const [cdTotal, setCdTotal] = useState(180000);
  const [tallies, setTallies] = useState({ cam1: "off", cam2: "off", cam3: "off", cam4: "off" });
  const [camNames, setCamNames] = useState({ cam1: "CAM 1", cam2: "CAM 2", cam3: "CAM 3", cam4: "CAM 4" });
  const [tab, setTab] = useState("timer");
  const [bridgeRef, setBridgeRef] = useState(null);
  const [roomMeta, setRoomMeta] = useState(null);
  const [showRoomInfo, setShowRoomInfo] = useState(false);

  useWakeLock(true);

  // ── Room metadata (TTL, expiry) ──
  useEffect(() => {
    getRoomMeta(roomCode).then(meta => { if (meta) setRoomMeta(meta); });
    const itv = setInterval(() => {
      getRoomMeta(roomCode).then(meta => { if (meta) setRoomMeta(meta); });
    }, 60000);
    return () => clearInterval(itv);
  }, [roomCode]);

  const fmtRemaining = (expiresAt) => {
    const diff = expiresAt - Date.now();
    if (diff <= 0) return t("lobby_expired");
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const handleDestroyRoom = () => {
    if (window.confirm(t("master_destroy_confirm"))) {
      destroyRoom(roomCode);
      onLeave();
    }
  };

  const handleExtend = async (hours) => {
    await extendRoom(roomCode, hours);
    const meta = await getRoomMeta(roomCode);
    if (meta) setRoomMeta(meta);
    try {
      const raw = localStorage.getItem("studiotally:activeRoom");
      if (raw) {
        const data = JSON.parse(raw);
        data.expiresAt = meta.expiresAt;
        localStorage.setItem("studiotally:activeRoom", JSON.stringify(data));
      }
    } catch(e) {}
  };

  // ── Timer engine — all state in refs for stable intervals ──
  const startRef = useRef(null);   // Date.now() when last started, null if stopped
  const savedRef = useRef(0);      // ms accumulated before last start
  const tickRef = useRef(null);
  const { write, viewers } = useFirebaseSync(roomCode, true);

  // Refs that mirror React state — so sync interval reads fresh values without deps
  const modeRef = useRef(mode);
  const runningRef = useRef(running);
  const cdTotalRef = useRef(cdTotal);
  const talliesRef = useRef(tallies);
  const camNamesRef = useRef(camNames);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { runningRef.current = running; }, [running]);
  useEffect(() => { cdTotalRef.current = cdTotal; }, [cdTotal]);
  useEffect(() => { talliesRef.current = tallies; }, [tallies]);
  useEffect(() => { camNamesRef.current = camNames; }, [camNames]);

  const getElapsed = () => {
    if (startRef.current) return savedRef.current + (Date.now() - startRef.current);
    return savedRef.current;
  };

  const startTick = () => {
    if (tickRef.current) return;
    tickRef.current = setInterval(() => {
      if (startRef.current) setMs(getElapsed());
    }, 250);
  };
  const stopTick = () => { if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; } };

  const doStart = () => {
    if (running) return;
    startRef.current = Date.now();
    setRunning(true);
    startTick();
    syncNow(); // immediate push to Firebase
  };
  const doPause = () => {
    if (!running) return;
    savedRef.current += Date.now() - startRef.current;
    startRef.current = null;
    setMs(savedRef.current);
    setRunning(false);
    stopTick();
    syncNow();
  };
  const doReset = () => {
    setRunning(false);
    setMs(0);
    savedRef.current = 0;
    startRef.current = null;
    stopTick();
    syncNow();
  };

  // Auto-stop countdown at zero
  useEffect(() => {
    if (mode === "countdown" && running && cdTotal - ms <= 0) {
      doPause(); savedRef.current = cdTotal; setMs(cdTotal);
    }
  }, [ms, mode, cdTotal, running]);

  // ── Firebase sync — single stable interval, reads from refs ──
  const syncNow = () => {
    const elapsed = getElapsed();
    write({
      mode: modeRef.current,
      running: runningRef.current,
      ms: elapsed,
      cdTotal: cdTotalRef.current,
      tallies: talliesRef.current,
      camNames: camNamesRef.current,
      mst: startRef.current || null,
      saved: savedRef.current,
    });
  };

  useEffect(() => {
    const itv = setInterval(syncNow, 500);
    return () => clearInterval(itv);
  }, [write]); // only depends on write (stable from useCallback)

  useEffect(() => () => stopTick(), []);

  // ── Bridge callbacks ──
  const handleBridgeTally = useCallback((bridgeTallies) => {
    setTallies(bridgeTallies);
    const names = {};
    Object.keys(bridgeTallies).forEach(k => {
      names[k] = camNames[k] || k.toUpperCase().replace("CAM", "CAM ");
    });
    setCamNames(prev => ({ ...prev, ...names }));
  }, [camNames]);

  const handleBridgeReady = useCallback((ref) => { setBridgeRef(ref); }, []);

  const sendToBridge = useCallback((cam, action) => {
    if (!bridgeRef) return;
    const camNum = parseInt(cam.replace("cam", ""));
    if (isNaN(camNum)) return;
    try {
      if (bridgeRef.type === "vmix") {
        if (action === "program") bridgeRef.sendCommand("Cut");
        if (action === "preview") bridgeRef.sendCommand("PreviewInput", { Input: String(camNum) });
      } else if (bridgeRef.type === "obs") {
        if (action === "program") bridgeRef.sendCommand("SetCurrentProgramScene", { sceneName: camNames[cam] || cam });
        if (action === "preview") bridgeRef.sendCommand("SetCurrentPreviewScene", { sceneName: camNames[cam] || cam });
      }
    } catch(e) {}
  }, [bridgeRef, camNames]);

  // ── Derived display values ──
  const displayMs = mode === "countdown" ? Math.max(0, cdTotal - ms) : ms;
  const rem = cdTotal - ms;
  const timerColor = mode === "stopwatch"
    ? (running ? "#ff5555" : ms > 0 ? "#ffb86c" : "#50fa7b")
    : (rem <= 0 ? "#ff5555" : rem <= 30000 ? "#ffb86c" : rem <= 60000 ? "#f1fa8c" : "#50fa7b");
  const status = mode === "stopwatch"
    ? (running ? t("master_on_air") : ms > 0 ? t("master_paused") : t("master_ready"))
    : (rem <= 0 ? t("master_time_up") : running ? "● COUNTDOWN" : ms > 0 ? t("master_paused") : t("master_ready"));

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div className="safe-top" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderBottom: "1px solid #12121e" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Badge color="#50fa7b">{t("lobby_role_master")}</Badge>
          <span onClick={() => setShowRoomInfo(!showRoomInfo)} style={{ fontFamily: FF, color: "#8be9fd88", fontSize: "0.82rem", letterSpacing: "0.25em", cursor: "pointer" }}>{roomCode}</span>
          {roomMeta?.expiresAt && (
            <span onClick={() => setShowRoomInfo(!showRoomInfo)} style={{ fontFamily: FF, color: "#666", fontSize: "0.45rem", cursor: "pointer" }}>
              {fmtRemaining(roomMeta.expiresAt)}
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontFamily: FF, color: "#333", fontSize: "0.5rem" }}>{viewers} {t("master_viewers")}</span>
          <Btn small color="#ff555566" onClick={onLeave}>{t("master_exit")}</Btn>
        </div>
      </div>

      {/* Room info panel */}
      {showRoomInfo && (
        <div style={{ padding: "10px 12px", background: "#0c0c16", borderBottom: "1px solid #1a1a2e" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontFamily: FF, color: "#888", fontSize: "0.5rem", letterSpacing: "0.2em" }}>{t("master_room_info")}</span>
            <Btn small color="#333" onClick={() => setShowRoomInfo(false)}>✕</Btn>
          </div>
          {roomMeta && (
            <div style={{ fontFamily: FF, fontSize: "0.55rem", color: "#666", lineHeight: 1.8 }}>
              {t("lobby_remaining")}: <span style={{ color: "#ffb86c" }}>{fmtRemaining(roomMeta.expiresAt)}</span>
            </div>
          )}
          <div style={{ display: "flex", gap: "5px", marginTop: "8px", flexWrap: "wrap" }}>
            {[12, 24, 48].map(h => (
              <Btn key={h} small color="#50fa7b" onClick={() => handleExtend(h)}>+{h}h</Btn>
            ))}
            <div style={{ flex: 1 }} />
            <Btn small color="#ff5555" onClick={handleDestroyRoom}>{t("master_destroy_room")}</Btn>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid #12121e" }}>
        {["timer", "tally", "bridge"].map(tb => (
          <button key={tb} onClick={() => setTab(tb)} style={{
            flex: 1, padding: "9px", background: "transparent", border: "none",
            borderBottom: tab === tb ? "2px solid #50fa7b" : "2px solid transparent",
            fontFamily: FF, fontSize: "0.6rem", letterSpacing: "0.25em",
            color: tab === tb ? "#50fa7b" : "#444", cursor: "pointer",
          }}>{tb === "bridge" ? `🔌 ${t("master_tab_bridge")}` : t(`master_tab_${tb}`)}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: "12px", overflowY: "auto" }}>
        {tab === "timer" && (
          <TimerPanel
            mode={mode} setMode={setMode} running={running} ms={ms}
            cdTotal={cdTotal} setCdTotal={setCdTotal} displayMs={displayMs}
            timerColor={timerColor} status={status}
            doStart={doStart} doPause={doPause} doReset={doReset}
          />
        )}
        {tab === "tally" && (
          <TallyPanel
            tallies={tallies} setTallies={setTallies}
            camNames={camNames} setCamNames={setCamNames}
            bridgeRef={bridgeRef} sendToBridge={sendToBridge}
          />
        )}
        {tab === "bridge" && (
          <BridgePanel onTallyUpdate={handleBridgeTally} onBridgeReady={handleBridgeReady} roomCode={roomCode} />
        )}
      </div>

      {mode === "countdown" && rem <= 0 && !running && ms > 0 && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, padding: "7px", background: "#ff555528", borderBottom: "2px solid #ff5555", textAlign: "center", fontFamily: FF, color: "#ff5555", fontSize: "0.75rem", letterSpacing: "0.3em", animation: "blink 1s infinite", zIndex: 100 }}>
          {t("master_time_up")}
        </div>
      )}
    </div>
  );
}
