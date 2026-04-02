// src/bridges/useVmixBridge.js
import { useState, useEffect, useRef, useCallback } from "react";

export function useVmixBridge(ip, enabled, onTally) {
  const [status, setStatus] = useState("disconnected");
  const [inputCount, setInputCount] = useState(0);
  const itvRef = useRef(null);
  const lastTallyRef = useRef("");

  useEffect(() => {
    if (!enabled || !ip) { setStatus("disconnected"); return; }

    const poll = async () => {
      try {
        const res = await fetch(`http://${ip}:8088/api`);
        if (!res.ok) throw new Error("HTTP " + res.status);
        const xml = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(xml, "text/xml");
        const inputs = doc.querySelectorAll("input");
        const activeNum = parseInt(doc.querySelector("active")?.textContent || "0");
        const previewNum = parseInt(doc.querySelector("preview")?.textContent || "0");

        const tallies = {};
        inputs.forEach((input, i) => {
          const num = i + 1;
          const key = `cam${num}`;
          if (num === activeNum) tallies[key] = "program";
          else if (num === previewNum) tallies[key] = "preview";
          else tallies[key] = "off";
        });

        const json = JSON.stringify(tallies);
        if (json !== lastTallyRef.current) {
          lastTallyRef.current = json;
          onTally(tallies);
        }
        setInputCount(inputs.length);
        setStatus("connected");
      } catch (err) {
        setStatus("error");
      }
    };

    poll();
    itvRef.current = setInterval(poll, 250);
    setStatus("connecting");
    return () => clearInterval(itvRef.current);
  }, [ip, enabled]);

  const sendCommand = useCallback(async (func, params = {}) => {
    if (!ip) return;
    try {
      const qs = new URLSearchParams({ Function: func, ...params }).toString();
      await fetch(`http://${ip}:8088/api?${qs}`);
    } catch (e) {}
  }, [ip]);

  return { status, inputCount, sendCommand };
}
