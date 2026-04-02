// ══════════════════════════════════════════════════════════════
// Firebase Config — funziona anche SENZA credenziali
// Senza Firebase → modalità locale (stesso dispositivo)
// Con Firebase → sync multi-dispositivo real-time
// ══════════════════════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyANltkT5tYux7ReGJY_UqjRehrsinraquo",
  authDomain: "broadcast-timer-608e4.firebaseapp.com",
  databaseURL: "https://broadcast-timer-608e4-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "broadcast-timer-608e4",
};

const isConfigured =
  firebaseConfig.apiKey !== "INCOLLA_QUI" &&
  firebaseConfig.databaseURL !== "INCOLLA_QUI";

let db = null;
let _fbModules = null;

// Init Firebase only if configured
async function initFB() {
  if (_fbModules) return _fbModules;
  if (!isConfigured) return null;
  try {
    const appMod = await import('firebase/app');
    const dbMod = await import('firebase/database');
    const authMod = await import('firebase/auth');
    const app = appMod.initializeApp(firebaseConfig);
    db = dbMod.getDatabase(app);
    const auth = authMod.getAuth(app);
    _fbModules = { db, auth, ...dbMod, ...authMod };
    console.log('✅ Firebase connesso');
    return _fbModules;
  } catch (e) {
    console.warn('⚠️ Firebase init fallito:', e.message);
    return null;
  }
}

if (isConfigured) initFB();
else console.log('ℹ️ Firebase non configurato — modalità locale attiva');

export const firebaseActive = isConfigured;

// ─── AUTH ───────────────────────────────────────
let _uid = 'local-' + Math.random().toString(36).slice(2, 10);

export async function ensureAuth() {
  const fb = await initFB();
  if (!fb) return _uid;
  try {
    const cred = await fb.signInAnonymously(fb.auth);
    _uid = cred.user.uid;
  } catch (e) {}
  return _uid;
}

// ─── LOCAL FALLBACK ─────────────────────────────
const _store = {};
const _listeners = {};

function _lSet(path, data) {
  _store[path] = data;
  try { localStorage.setItem('btp:' + path, JSON.stringify(data)); } catch(e) {}
  (_listeners[path] || []).forEach(cb => { try { cb(data); } catch(e) {} });
}

function _lGet(path) {
  if (_store[path] !== undefined) return _store[path];
  try {
    const s = localStorage.getItem('btp:' + path);
    return s ? JSON.parse(s) : null;
  } catch(e) { return null; }
}

function _lOn(path, cb) {
  if (!_listeners[path]) _listeners[path] = [];
  _listeners[path].push(cb);
  const d = _lGet(path);
  if (d) setTimeout(() => cb(d), 0);
  return () => { _listeners[path] = (_listeners[path] || []).filter(x => x !== cb); };
}

// ─── TTL PRESETS (hours) ─────────────────────────
export const ROOM_TTL_PRESETS = [
  { label: "4h",  hours: 4 },
  { label: "12h", hours: 12 },
  { label: "24h", hours: 24 },
  { label: "48h", hours: 48 },
  { label: "72h", hours: 72 },
  { label: "7d",  hours: 168 },
];
export const DEFAULT_TTL_HOURS = 72;

// ─── ROOM API ───────────────────────────────────
export async function createRoom(code, ttlHours = DEFAULT_TTL_HOURS) {
  const fb = await initFB();
  const now = Date.now();
  const expiresAt = now + ttlHours * 3600000;
  if (fb) {
    const uid = await ensureAuth();
    await fb.set(fb.ref(fb.db, `rooms/${code}`), {
      masterUid: uid, createdAt: now, expiresAt, ttlHours, state: null,
    });
  } else {
    _lSet(`rooms/${code}`, { masterUid: _uid, createdAt: now, expiresAt, ttlHours });
  }
}

export async function roomExists(code) {
  const fb = await initFB();
  if (fb) {
    const snap = await fb.get(fb.ref(fb.db, `rooms/${code}`));
    if (!snap.exists()) return false;
    const data = snap.val();
    if (data.expiresAt && Date.now() > data.expiresAt) {
      deleteRoom(code);
      return false;
    }
    return true;
  }
  const local = _lGet(`rooms/${code}`);
  if (!local) return false;
  if (local.expiresAt && Date.now() > local.expiresAt) { deleteRoom(code); return false; }
  return true;
}

// Get room metadata (for rejoin)
export async function getRoomMeta(code) {
  const fb = await initFB();
  if (fb) {
    const snap = await fb.get(fb.ref(fb.db, `rooms/${code}`));
    if (!snap.exists()) return null;
    const data = snap.val();
    if (data.expiresAt && Date.now() > data.expiresAt) { deleteRoom(code); return null; }
    return { masterUid: data.masterUid, createdAt: data.createdAt, expiresAt: data.expiresAt, ttlHours: data.ttlHours };
  }
  const local = _lGet(`rooms/${code}`);
  if (!local) return null;
  if (local.expiresAt && Date.now() > local.expiresAt) { deleteRoom(code); return null; }
  return local;
}

// Extend room TTL
export async function extendRoom(code, additionalHours) {
  const fb = await initFB();
  if (fb) {
    const m = await import('firebase/database');
    const snap = await m.get(m.ref(db, `rooms/${code}/expiresAt`));
    const current = snap.val() || Date.now();
    const newExpiry = Math.max(current, Date.now()) + additionalHours * 3600000;
    await m.set(m.ref(db, `rooms/${code}/expiresAt`), newExpiry);
  } else {
    const local = _lGet(`rooms/${code}`);
    if (local) {
      local.expiresAt = Math.max(local.expiresAt || Date.now(), Date.now()) + additionalHours * 3600000;
      _lSet(`rooms/${code}`, local);
    }
  }
}

// Destroy room explicitly (manual delete by master)
export async function destroyRoom(code) {
  deleteRoom(code);
  try { localStorage.removeItem('studiotally:activeRoom'); } catch(e) {}
}

export function writeState(code, state) {
  const data = { ...state, _t: Date.now() };
  if (db) {
    import('firebase/database').then(m => m.set(m.ref(db, `rooms/${code}/state`), data)).catch(() => {});
  } else {
    _lSet(`rooms/${code}/state`, data);
  }
}

export function onState(code, callback) {
  if (db) {
    let unsub = null;
    import('firebase/database').then(m => {
      unsub = m.onValue(m.ref(db, `rooms/${code}/state`), snap => callback(snap.val()));
    });
    return () => { if (unsub) unsub(); };
  }
  return _lOn(`rooms/${code}/state`, callback);
}

export function deleteRoom(code) {
  if (db) {
    import('firebase/database').then(m => m.remove(m.ref(db, `rooms/${code}`))).catch(() => {});
  } else {
    delete _store[`rooms/${code}`];
    try { localStorage.removeItem('btp:rooms/' + code); } catch(e) {}
  }
}

// ─── VIEWER PRESENCE ────────────────────────────
export async function registerViewer(code) {
  const fb = await initFB();
  if (fb) {
    const uid = await ensureAuth();
    const vRef = fb.ref(fb.db, `rooms/${code}/viewers/${uid}`);
    await fb.set(vRef, Date.now());
    const itv = setInterval(() => fb.set(vRef, Date.now()), 5000);
    return () => { clearInterval(itv); fb.remove(vRef); };
  }
  const v = _lGet(`rooms/${code}/viewers`) || {};
  v[_uid] = Date.now();
  _lSet(`rooms/${code}/viewers`, v);
  const itv = setInterval(() => {
    const vv = _lGet(`rooms/${code}/viewers`) || {};
    vv[_uid] = Date.now();
    _lSet(`rooms/${code}/viewers`, vv);
  }, 5000);
  return () => clearInterval(itv);
}

export function onViewerCount(code, callback) {
  if (db) {
    import('firebase/database').then(m => {
      m.onValue(m.ref(db, `rooms/${code}/viewers`), snap => {
        const data = snap.val() || {};
        callback(Object.values(data).filter(t => Date.now() - t < 15000).length);
      });
    });
    return;
  }
  const check = () => {
    const data = _lGet(`rooms/${code}/viewers`) || {};
    callback(Object.values(data).filter(t => Date.now() - t < 15000).length);
  };
  check();
  return setInterval(check, 3000);
}

// ─── VMIX COMMANDS ──────────────────────────────
export async function sendVmixCommand(code, func, params = {}) {
  if (!db) return;
  const m = await import('firebase/database');
  return m.set(m.ref(db, `rooms/${code}/vmixCommands/${Date.now()}`), { function: func, params, ts: Date.now() });
}
