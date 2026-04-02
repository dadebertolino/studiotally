import { useState, useEffect, useRef, useCallback } from 'react';
import {
  createRoom,
  roomExists,
  writeState,
  onState,
  deleteRoom,
  registerViewer,
  onViewerCount,
} from './firebase-config.js';

/**
 * useFirebaseSync — drop-in replacement for the persistent storage sync.
 * 
 * Master: writes state to Firebase RTDB (no polling, direct push)
 * Viewer: listens via onValue (real-time, <100ms latency)
 */
export function useFirebaseSync(roomCode, isMaster) {
  const [remote, setRemote] = useState(null);
  const [viewers, setViewers] = useState(0);
  const [connected, setConnected] = useState(false);
  const unsubRef = useRef(null);
  const viewerCleanupRef = useRef(null);

  // Setup listener
  useEffect(() => {
    if (!roomCode) return;

    const setup = async () => {
      try {
        if (isMaster) {
          // Read pending TTL from localStorage (set by App.jsx on create)
          let ttl = 72;
          try {
            const pending = localStorage.getItem("studiotally:pendingTTL");
            if (pending) { ttl = parseInt(pending) || 72; localStorage.removeItem("studiotally:pendingTTL"); }
          } catch(e) {}
          await createRoom(roomCode, ttl);
        }

        // Listen to state changes (both master and viewer)
        unsubRef.current = onState(roomCode, (state) => {
          if (state) {
            setRemote(state);
            setConnected(true);
          }
        });

        if (isMaster) {
          // Listen to viewer count
          onViewerCount(roomCode, setViewers);
        } else {
          // Register as viewer with heartbeat
          viewerCleanupRef.current = await registerViewer(roomCode);
        }

        setConnected(true);
      } catch (err) {
        console.error('[Firebase] Setup error:', err);
        setConnected(false);
      }
    };

    setup();

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
      }
      if (viewerCleanupRef.current) {
        viewerCleanupRef.current();
      }
      // Room persists — master can rejoin later. No deleteRoom here.
    };
  }, [roomCode, isMaster]);

  // Write function for master
  const write = useCallback(
    (state) => {
      if (!roomCode || !isMaster) return;
      writeState(roomCode, state);
    },
    [roomCode, isMaster]
  );

  // Check if room exists
  const checkRoom = useCallback(async (code) => {
    return roomExists(code);
  }, []);

  return { write, remote, viewers, connected, checkRoom };
}
