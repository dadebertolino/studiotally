// src/bridges/useObsBridge.js
import { useState, useEffect, useRef, useCallback } from "react";

export function useObsBridge(ip, port, password, enabled, onTally) {
  const [status, setStatus] = useState("disconnected");
  const [scenes, setScenes] = useState([]);
  const wsRef = useRef(null);
  const scenesRef = useRef([]);

  useEffect(() => {
    if (!enabled || !ip) { setStatus("disconnected"); return; }

    let ws = null;
    let identified = false;
    let closed = false;

    const connect = () => {
      if (closed) return;
      setStatus("connecting");
      try {
        ws = new WebSocket(`ws://${ip}:${port || 4455}`);
        wsRef.current = ws;
      } catch(e) { setStatus("error"); return; }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.op === 0) {
            ws.send(JSON.stringify({ op: 1, d: { rpcVersion: 1 } }));
          }
          if (msg.op === 2) {
            identified = true;
            setStatus("connected");
            ws.send(JSON.stringify({ op: 6, d: { requestType: "GetSceneList", requestId: "scenes" } }));
            ws.send(JSON.stringify({ op: 6, d: { requestType: "GetCurrentProgramScene", requestId: "pgm" } }));
          }
          if (msg.op === 7) {
            const rid = msg.d?.requestId;
            const data = msg.d?.responseData;
            if (rid === "scenes" && data?.scenes) {
              const s = [...data.scenes].reverse();
              scenesRef.current = s;
              setScenes(s);
              ws.send(JSON.stringify({ op: 6, d: { requestType: "GetCurrentProgramScene", requestId: "pgm" } }));
            }
            if (rid === "pgm" && data?.currentProgramSceneName) {
              buildTally(data.currentProgramSceneName, null);
              ws.send(JSON.stringify({ op: 6, d: { requestType: "GetCurrentPreviewScene", requestId: "pvw" } }));
            }
          }
          if (msg.op === 5) {
            const etype = msg.d?.eventType;
            if (["CurrentProgramSceneChanged", "CurrentPreviewSceneChanged", "StudioModeStateChanged", "SceneListChanged"].includes(etype)) {
              ws.send(JSON.stringify({ op: 6, d: { requestType: "GetSceneList", requestId: "scenes" } }));
            }
          }
        } catch(e) {}
      };

      ws.onclose = () => {
        identified = false;
        if (!closed) { setStatus("reconnecting"); setTimeout(connect, 3000); }
      };
      ws.onerror = () => {};
    };

    const buildTally = (pgmName, pvwName) => {
      const tallies = {};
      scenesRef.current.forEach((scene, i) => {
        const key = `cam${i + 1}`;
        if (scene.sceneName === pgmName) tallies[key] = "program";
        else if (scene.sceneName === pvwName) tallies[key] = "preview";
        else tallies[key] = "off";
      });
      onTally(tallies);
    };

    connect();
    return () => { closed = true; if (ws) ws.close(); };
  }, [ip, port, password, enabled]);

  const sendCommand = useCallback((requestType, requestData = {}) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ op: 6, d: { requestType, requestId: "cmd_" + Date.now(), requestData } }));
    }
  }, []);

  return { status, scenes, sendCommand };
}
