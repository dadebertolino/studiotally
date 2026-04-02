// src/useWakeLock.js
import { useEffect, useRef } from "react";

export function useWakeLock(active) {
  const wakeLockRef = useRef(null);
  const videoRef = useRef(null);

  useEffect(() => {
    if (!active) {
      if (wakeLockRef.current) { try { wakeLockRef.current.release(); } catch(e) {} wakeLockRef.current = null; }
      if (videoRef.current) { videoRef.current.pause(); videoRef.current.remove(); videoRef.current = null; }
      return;
    }

    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLockRef.current = await navigator.wakeLock.request("screen");
          wakeLockRef.current.addEventListener("release", () => { wakeLockRef.current = null; });
          return true;
        }
      } catch(e) {}
      return false;
    };

    const startVideoHack = () => {
      if (videoRef.current) return;
      const video = document.createElement("video");
      video.setAttribute("playsinline", "");
      video.setAttribute("muted", "");
      video.setAttribute("loop", "");
      video.style.cssText = "position:fixed;top:-1px;left:-1px;width:1px;height:1px;opacity:0.01";
      video.src = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAAAAhmcmVlAAAAGm1kYXQAAABCAAAAAwAAAAMAAAADAAAAAwAAAAMAAAJUbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAUp0cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAgAAAAIAAAAAABkbWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAAAoAAAAKABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABB21pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAAMdzdGJsAAAAW3N0c2QAAAAAAAAAAQAAAEthdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAgACABIAAAASAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAGP//AAAAEmNvbHJuY2xjAAEAAQABAAAAEHBhc3AAAAABAAAAAQAAABhzdHRzAAAAAAAAAAEAAAABAAAAAQAAABRzdHNzAAAAAAAAAAEAAAABAAAAEHN0c2MAAAAAAAAAAAAAABRzdHN6AAAAAAAAAAMAAAABAAAAFHN0Y28AAAAAAAAAAQAAACQ=";
      document.body.appendChild(video);
      video.play().catch(() => {});
      videoRef.current = video;
    };

    requestWakeLock().then(success => { if (!success) startVideoHack(); });

    const handleVisibility = () => {
      if (document.visibilityState === "visible" && active) requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (wakeLockRef.current) { try { wakeLockRef.current.release(); } catch(e) {} }
      if (videoRef.current) { videoRef.current.pause(); videoRef.current.remove(); videoRef.current = null; }
    };
  }, [active]);
}
