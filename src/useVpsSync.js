// src/useVpsSync.js — Cloud sync via VPS WebSocket (sostituisce useFirebaseSync)
// Stessa firma di useFirebaseSync: { write, remote, viewers, connected, checkRoom }
//
// CLOCK SYNC: i timestamp "mst" (master start time) viaggiano in TEMPO-SERVER.
// - in write(): convertiamo i mst da tempo-locale-Master a tempo-server (+offset)
// - in onmessage: riconvertiamo i mst da tempo-server a tempo-locale-del-ricevente (-offset)
// Cosi' Master.jsx e Viewer.jsx continuano a usare `Date.now() - mst` SENZA modifiche,
// e gli orologi sfasati dei dispositivi si annullano.

import { useState, useEffect, useRef, useCallback } from 'react';

const WS_URL   = 'wss://ws.studiotally.com';
const HTTP_URL = 'https://ws.studiotally.com';

let _clockOffset = 0; // serverTime - clientTime (stimato all'handshake NTP)
export function getClockOffset() { return _clockOffset; }

// Converte i campi mst di uno state da localTime -> serverTime (per inviare)
function mstToServer(state, off) {
  if (!state || !off) return state;
  const s = { ...state };
  if (s.mst) s.mst = s.mst + off;
  if (s.showClock?.mst) s.showClock = { ...s.showClock, mst: s.showClock.mst + off };
  if (s.camTimers) {
    const ct = {};
    for (const k of Object.keys(s.camTimers)) {
      const c = s.camTimers[k];
      ct[k] = c?.mst ? { ...c, mst: c.mst + off } : c;
    }
    s.camTimers = ct;
  }
  return s;
}

// Converte i campi mst di uno state da serverTime -> localTime (per leggere)
function mstToLocal(state, off) {
  if (!state || !off) return state;
  const s = { ...state };
  if (s.mst) s.mst = s.mst - off;
  if (s.showClock?.mst) s.showClock = { ...s.showClock, mst: s.showClock.mst - off };
  if (s.camTimers) {
    const ct = {};
    for (const k of Object.keys(s.camTimers)) {
      const c = s.camTimers[k];
      ct[k] = c?.mst ? { ...c, mst: c.mst - off } : c;
    }
    s.camTimers = ct;
  }
  return s;
}

export function useVpsSync(roomCode, isMaster) {
  const [remote, setRemote] = useState(null);
  const [viewers, setViewers] = useState(0);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);
  const reconnectRef = useRef(null);
  const mountedRef = useRef(true);

  const syncClock = useCallback((ws) => {
    const samples = []; let count = 0;
    const doPing = () => {
      if (ws.readyState !== 1) return;
      const t0 = Date.now();
      const handler = (ev) => {
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.type === 'pong' && m.t0 === t0) {
          const rtt = Date.now() - t0;
          samples.push(m.serverTime - (t0 + rtt / 2));
          ws.removeEventListener('message', handler);
          if (++count < 5) setTimeout(doPing, 120);
          else { samples.sort((a, b) => a - b); _clockOffset = samples[Math.floor(samples.length / 2)]; }
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ type: 'ping', t0 }));
    };
    doPing();
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    if (!roomCode) return;
    let intentionalClose = false;

    const init = async () => {
      // il master crea/garantisce la room (TTL da localStorage, come nel flusso Firebase)
      if (isMaster) {
        let ttl = 72;
        try {
          const pending = localStorage.getItem('studiotally:pendingTTL');
          if (pending) { ttl = parseInt(pending) || 72; localStorage.removeItem('studiotally:pendingTTL'); }
        } catch (e) {}
        let pin = null;
        try {
          const pp = localStorage.getItem('studiotally:pendingPin');
          if (pp) { pin = pp; localStorage.removeItem('studiotally:pendingPin'); }
        } catch (e) {}
        try {
          await fetch(`${HTTP_URL}/room`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code: roomCode, ttlHours: ttl, directorPin: pin }),
          });
        } catch (e) { console.error('[VPS] createRoom error', e); }
      }
      connect();
    };

    const connect = () => {
      if (!mountedRef.current || intentionalClose) return;
      if (wsRef.current) { try { wsRef.current.close(); } catch (e) {} wsRef.current = null; }

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mountedRef.current) return;
        let joinPin = '';
        try { joinPin = localStorage.getItem('studiotally:joinPin') || ''; } catch (e) {}
        ws.send(JSON.stringify({ type: 'join', code: roomCode, role: isMaster ? 'director' : 'camera', pin: joinPin }));
        syncClock(ws);
        setConnected(true);
      };

      ws.onmessage = (ev) => {
        if (!mountedRef.current) return;
        let m; try { m = JSON.parse(ev.data); } catch { return; }
        if (m.type === 'state') {
          setRemote(mstToLocal(m.state, _clockOffset));
          setConnected(true);
        } else if (m.type === 'patch') {
          setRemote(prev => {
            const base = prev || {};
            const next = { ...base };
            for (const k of Object.keys(m.data)) {
              next[k] = (typeof m.data[k] === 'object' && m.data[k] && !Array.isArray(m.data[k]))
                ? { ...base[k], ...m.data[k] } : m.data[k];
            }
            return mstToLocal(next, _clockOffset);
          });
        } else if (m.type === 'timer') {
          setRemote(prev => ({ ...(prev || {}), timer: m.timer }));
        } else if (m.type === 'viewers') {
          setViewers(m.count);
        } else if (m.type === 'destroyed') {
          setRemote(null);
        }
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        setConnected(false);
        wsRef.current = null;
        if (!intentionalClose) reconnectRef.current = setTimeout(connect, 2000);
      };
      ws.onerror = () => { try { ws.close(); } catch (e) {} };
    };

    init();

    return () => {
      mountedRef.current = false;
      intentionalClose = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) { try { wsRef.current.close(); } catch (e) {} wsRef.current = null; }
    };
  }, [roomCode, isMaster, syncClock]);

  // write(state) in blocco — compat con useFirebaseSync. Converte mst -> tempo-server.
  const write = useCallback((state) => {
    if (!isMaster) return;
    const ws = wsRef.current;
    if (!ws || ws.readyState !== 1) return;
    try { ws.send(JSON.stringify({ type: 'write', state: mstToServer(state, _clockOffset) })); } catch (e) {}
  }, [isMaster]);

  const checkRoom = useCallback(async (code) => {
    try { const r = await fetch(`${HTTP_URL}/room/${code}`); return r.ok && (await r.json()).exists; }
    catch { return false; }
  }, []);

  return { write, remote, viewers, connected, checkRoom };
}

// ─── Room API (sostituiscono quelle di firebase-config.js) ───
export const ROOM_TTL_PRESETS = [
  { label: '4h', hours: 4 }, { label: '12h', hours: 12 }, { label: '24h', hours: 24 },
  { label: '48h', hours: 48 }, { label: '72h', hours: 72 }, { label: '7d', hours: 168 },
];
export const DEFAULT_TTL_HOURS = 72;

export async function verifyPin(code, pin) {
  try {
    const r = await fetch(`${HTTP_URL}/room/${code}/verify-pin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: pin || '' }),
    });
    if (!r.ok) return { ok: false };
    return await r.json(); // { ok, hasPin }
  } catch (e) { return { ok: false }; }
}

export async function roomExists(code) {
  try { const r = await fetch(`${HTTP_URL}/room/${code}`); return r.ok && (await r.json()).exists; }
  catch { return false; }
}

export async function getRoomMeta(code) {
  try {
    const r = await fetch(`${HTTP_URL}/room/${code}`);
    if (!r.ok) return null;
    const d = await r.json();
    return d.exists ? { createdAt: d.createdAt, expiresAt: d.expiresAt, ttlHours: d.ttlHours } : null;
  } catch { return null; }
}

export async function extendRoom(code, hours) {
  try {
    await fetch(`${HTTP_URL}/room/${code}/extend`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours }),
    });
  } catch (e) {}
}

export async function destroyRoom(code) {
  try { await fetch(`${HTTP_URL}/room/${code}`, { method: 'DELETE' }); } catch (e) {}
  try { localStorage.removeItem('studiotally:activeRoom'); } catch (e) {}
}

// sendBridgeCommand — invia comandi al bridge (vMix/ATEM) via WS
let _bridgeWs = null;
export function _setBridgeWs(ws) { _bridgeWs = ws; }
export async function sendBridgeCommand(code, func, params = {}) {
  // I comandi bridge in cloud-VPS passano come patch su bridgeCommands
  try {
    await fetch(`${HTTP_URL}/room/${code}/bridge-command`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ function: func, params, ts: Date.now() }),
    });
  } catch (e) {}
}

// ensureAuth — no-op sul VPS (compat con App.jsx)
export async function ensureAuth() { return null; }
