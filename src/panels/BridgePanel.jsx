// src/panels/BridgePanel.jsx
import { useState, useEffect, useCallback } from "react";
import { FF } from "../styles/constants.js";
import { t } from "../i18n.js";
import { Btn, Badge, Card, Label, StatusDot } from "../components/UI.jsx";
import { useVmixBridge } from "../bridges/useVmixBridge.js";
import { useObsBridge } from "../bridges/useObsBridge.js";

export function BridgePanel({ onTallyUpdate, onBridgeReady, roomCode }) {
  const [switcher, setSwitcher] = useState(null);
  const [ip, setIp] = useState("");
  const [obsPort, setObsPort] = useState("4455");
  const [obsPw, setObsPw] = useState("");
  const [bridgeEnabled, setBridgeEnabled] = useState(false);

  const vmix = useVmixBridge(ip, bridgeEnabled && switcher === "vmix", onTallyUpdate);
  const obs = useObsBridge(ip, obsPort, obsPw, bridgeEnabled && switcher === "obs", onTallyUpdate);
  const activeStatus = switcher === "vmix" ? vmix.status : switcher === "obs" ? obs.status : "disconnected";

  useEffect(() => {
    if (activeStatus === "connected" && onBridgeReady) {
      onBridgeReady({ type: switcher, sendCommand: switcher === "vmix" ? vmix.sendCommand : obs.sendCommand, status: activeStatus });
    } else if (activeStatus !== "connected" && onBridgeReady) {
      onBridgeReady(null);
    }
  }, [activeStatus, switcher]);

  if (!switcher) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Label>{t("bridge_choose")}</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {[
            { id: "vmix", name: "vMix", desc: t("bridge_vmix_desc"), color: "#50fa7b", badge: t("bridge_zero_install") },
            { id: "obs", name: "OBS Studio", desc: t("bridge_obs_desc"), color: "#8be9fd", badge: t("bridge_zero_install") },
            { id: "atem", name: "Blackmagic ATEM", desc: t("bridge_atem_desc"), color: "#ffb86c", badge: t("bridge_desktop_app") },
          ].map(s => (
            <div key={s.id} onClick={() => { if (s.id !== "atem") setSwitcher(s.id); }} style={{
              border: `1px solid ${s.id === "atem" ? "#1a1a2e" : s.color + "33"}`, borderRadius: "6px", padding: "14px",
              background: s.id === "atem" ? "#08080e" : "#0c0c14", cursor: s.id === "atem" ? "default" : "pointer",
              opacity: s.id === "atem" ? 0.5 : 1, WebkitTapHighlightColor: "transparent",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <div>
                <div style={{ fontFamily: FF, color: s.color, fontSize: "0.8rem", letterSpacing: "0.1em" }}>{s.name}</div>
                <div style={{ fontFamily: FF, color: "#444", fontSize: "0.55rem", marginTop: "3px" }}>{s.desc}</div>
              </div>
              <Badge color={s.id === "atem" ? "#ffb86c" : s.color}>{s.badge}</Badge>
            </div>
          ))}
        </div>
        <Card style={{ marginTop: "4px" }}>
          <div style={{ fontFamily: FF, color: "#555", fontSize: "0.52rem", lineHeight: 1.8, letterSpacing: "0.04em" }}>
            {t("bridge_info")}
            <br/><br/>
            <span style={{ color: "#ffb86c" }}>ATEM</span><span style={{ color: "#777" }}> {t("bridge_atem_info")} </span><span style={{ color: "#8be9fd" }}>127.0.0.1</span><span style={{ color: "#777" }}> {t("bridge_atem_proxy")}</span>
          </div>
        </Card>
      </div>
    );
  }

  const statusLabels = { connected: t("bridge_connected"), connecting: t("bridge_connecting"), error: t("bridge_error"), disconnected: t("bridge_disconnected") };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <StatusDot status={activeStatus} />
          <span style={{ fontFamily: FF, color: switcher === "vmix" ? "#50fa7b" : "#8be9fd", fontSize: "0.75rem", letterSpacing: "0.15em" }}>{switcher.toUpperCase()}</span>
          <span style={{ fontFamily: FF, color: "#333", fontSize: "0.55rem" }}>{statusLabels[activeStatus] || activeStatus}</span>
        </div>
        <Btn small color="#444" onClick={() => { setSwitcher(null); setBridgeEnabled(false); }}>{t("bridge_change")}</Btn>
      </div>

      <Card>
        <Label>{t("bridge_ip_label")} {switcher === "vmix" ? "PC VMIX" : "PC OBS"}</Label>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input value={ip} onChange={e => setIp(e.target.value)} placeholder={switcher === "vmix" ? "192.168.1.100" : "192.168.1.50"} style={{ flex: 1, padding: "10px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "0.82rem", outline: "none", borderRadius: "4px" }} />
          {!bridgeEnabled
            ? <Btn small color="#50fa7b" filled disabled={!ip} onClick={() => setBridgeEnabled(true)}>{t("bridge_connect")}</Btn>
            : <Btn small color="#ff5555" onClick={() => setBridgeEnabled(false)}>{t("bridge_stop")}</Btn>}
        </div>
        {switcher === "obs" && (
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <input value={obsPort} onChange={e => setObsPort(e.target.value)} placeholder="4455" style={{ width: "70px", padding: "10px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "0.8rem", textAlign: "center", outline: "none", borderRadius: "4px" }} />
            <input value={obsPw} onChange={e => setObsPw(e.target.value)} placeholder="Password" type="password" style={{ flex: 1, padding: "10px", border: "1px solid #1a1a2e", background: "#08080e", color: "#eee", fontFamily: FF, fontSize: "0.8rem", outline: "none", borderRadius: "4px" }} />
          </div>
        )}
        {activeStatus === "error" && (
          <div style={{ fontFamily: FF, color: "#ff555599", fontSize: "0.55rem", marginTop: "8px", lineHeight: 1.6 }}>
            {switcher === "vmix" ? t("bridge_vmix_error") : t("bridge_obs_error")}
          </div>
        )}
      </Card>

      {activeStatus === "connected" && (
        <Card>
          <Label>{t("bridge_quick_cmds")}</Label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
            {switcher === "vmix" ? (
              <>
                <Btn small color="#ff5555" onClick={() => vmix.sendCommand("Cut")}>CUT</Btn>
                <Btn small color="#ffb86c" onClick={() => vmix.sendCommand("Fade")}>FADE</Btn>
                <Btn small color="#ff5555" onClick={() => vmix.sendCommand("StartRecording")}>● REC</Btn>
                <Btn small color="#666" onClick={() => vmix.sendCommand("StopRecording")}>■ STOP</Btn>
              </>
            ) : (
              <>
                <Btn small color="#ff5555" onClick={() => obs.sendCommand("TriggerStudioModeTransition")}>CUT/TRANS</Btn>
                <Btn small color="#ffb86c" onClick={() => obs.sendCommand("ToggleStudioMode")}>STUDIO MODE</Btn>
                <Btn small color="#ff5555" onClick={() => obs.sendCommand("StartRecord")}>● REC</Btn>
                <Btn small color="#666" onClick={() => obs.sendCommand("StopRecord")}>■ STOP</Btn>
              </>
            )}
          </div>
          {switcher === "vmix" && vmix.inputCount > 0 && (
            <div style={{ fontFamily: FF, color: "#333", fontSize: "0.5rem", marginTop: "8px" }}>{vmix.inputCount} {t("bridge_inputs_detected")}</div>
          )}
        </Card>
      )}

      <Card>
        <div style={{ fontFamily: FF, color: "#2a2a3a", fontSize: "0.5rem", lineHeight: 1.8, letterSpacing: "0.03em" }}>
          {switcher === "vmix" ? t("bridge_vmix_hint") : t("bridge_obs_hint")}
        </div>
      </Card>
    </div>
  );
}
