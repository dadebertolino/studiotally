// src/App.jsx — Router + global styles — supports Cloud + LAN modes
import { useState, useEffect } from "react";
import { genCode } from "./styles/constants.js";
import { ensureAuth, roomExists, getRoomMeta } from "./firebase-config.js";
import { Landing } from "./screens/Landing.jsx";
import { Lobby } from "./screens/Lobby.jsx";
import { Master } from "./screens/Master.jsx";
import { Viewer } from "./screens/Viewer.jsx";

function saveActiveRoom(code, role, expiresAt) {
  try { localStorage.setItem("studiotally:activeRoom", JSON.stringify({ code, role, expiresAt })); } catch(e) {}
}

export default function App() {
  const [screen, setScreen] = useState("landing");
  const [room, setRoom] = useState("");
  const [role, setRole] = useState(null);
  const [syncMode, setSyncMode] = useState("cloud"); // "cloud" | "lan"
  const [wsUrl, setWsUrl] = useState("");

  useEffect(() => { ensureAuth().catch(() => {}); }, []);

  const handleCreate = async (ttlHours) => {
    const code = genCode();
    setRoom(code); setRole("master"); setSyncMode("cloud"); setScreen("room");
    saveActiveRoom(code, "master", Date.now() + ttlHours * 3600000);
    try { localStorage.setItem("studiotally:pendingTTL", String(ttlHours)); } catch(e) {}
  };

  const handleJoin = async (code) => {
    try {
      if (await roomExists(code)) {
        setRoom(code); setRole("viewer"); setSyncMode("cloud"); setScreen("room");
        const meta = await getRoomMeta(code);
        saveActiveRoom(code, "viewer", meta?.expiresAt || Date.now() + 72 * 3600000);
        return true;
      }
    } catch(e) {}
    return false;
  };

  const handleRejoin = (code, savedRole) => {
    setRoom(code); setRole(savedRole); setSyncMode("cloud"); setScreen("room");
  };

  const handleLanConnect = (url, lanRole) => {
    setWsUrl(url); setRole(lanRole); setSyncMode("lan"); setRoom("LAN"); setScreen("room");
  };

  const handleLeave = () => {
    setScreen("lobby"); setRoom(""); setRole(null); setSyncMode("cloud"); setWsUrl("");
  };

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0f", position: "relative" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0a0f; }
        .safe-top {
          padding-top: 44px;
          padding-top: calc(env(safe-area-inset-top, 20px) + 8px);
          padding-top: calc(constant(safe-area-inset-top, 20px) + 8px);
        }
        .safe-bottom {
          padding-bottom: 20px;
          padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px);
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes pulse-border { 0%,100%{border-color:#ffb86c22} 50%{border-color:#ffb86c77} }
        @keyframes fadeSlide { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none}
        input[type=number]{-moz-appearance:textfield}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#0a0a0f}::-webkit-scrollbar-thumb{background:#151522;border-radius:2px}
      `}</style>
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "repeating-linear-gradient(0deg, transparent, transparent 3px, #00000006 3px, #00000006 4px)", pointerEvents: "none", zIndex: 200 }} />
      {screen === "landing" && <Landing onStart={() => setScreen("lobby")} />}
      {screen === "lobby" && <Lobby onCreateRoom={handleCreate} onJoinRoom={handleJoin} onRejoin={handleRejoin} onLanConnect={handleLanConnect} onBack={() => setScreen("landing")} />}
      {screen === "room" && role === "master" && <Master roomCode={room} syncMode={syncMode} wsUrl={wsUrl} onLeave={handleLeave} />}
      {screen === "room" && role === "viewer" && <Viewer roomCode={room} syncMode={syncMode} wsUrl={wsUrl} onLeave={handleLeave} />}
    </div>
  );
}
