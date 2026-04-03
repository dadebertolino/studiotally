// src/useWebSocketSync.js — LAN mode sync via WebSocket to bridge .NET
import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useWebSocketSync — connects to bridge WebSocket server on LAN.
 * Same API as useFirebaseSync: { write, remote, viewers, connected }
 *
 * @param {string} wsUrl - WebSocket URL, e.g. "ws://192.168.1.50:9900"
 * @param {boolean} isMaster - true if this device is the master
 */
export function useWebSocketSync(wsUrl, isMaster) {
  const [remote, setRemote] = useState(null);
  const [connected, setConnected] = useState(false);
  const [viewers, setViewers] = useState(0);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);

  useEffect(() => {
    if (!wsUrl) return;

    let closed = false;

    const connect = () => {
      if (closed) return;
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          setConnected(true);
          // Identify as master or viewer
          ws.send(JSON.stringify({ type: "identify", role: isMaster ? "master" : "viewer" }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            setRemote(data);
            // Client count comes from bridge state
            if (data._clients !== undefined) setViewers(data._clients);
          } catch (e) {}
        };

        ws.onclose = () => {
          setConnected(false);
          wsRef.current = null;
          // Reconnect after 2s
          if (!closed) {
            reconnectRef.current = setTimeout(connect, 2000);
          }
        };

        ws.onerror = () => {};
      } catch (e) {
        if (!closed) {
          reconnectRef.current = setTimeout(connect, 2000);
        }
      }
    };

    connect();

    return () => {
      closed = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch (e) {}
        wsRef.current = null;
      }
    };
  }, [wsUrl, isMaster]);

  // Write state — master sends full state to bridge, which broadcasts to all
  const write = useCallback((state) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "state", ...state }));
  }, []);

  // Send command to bridge → vMix
  const sendCommand = useCallback((func, params = {}) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: "command", function: func, params }));
  }, []);

  return { write, remote, viewers, connected, sendCommand };
}
