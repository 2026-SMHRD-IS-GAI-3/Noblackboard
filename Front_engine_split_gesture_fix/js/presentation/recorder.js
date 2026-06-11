import { SCHEMA_VERSION, STORAGE_KEYS } from "../core/constants.js";
import { writeJson } from "../core/storage.js";

export function createPresentationRecorder({
  storage = localStorage,
  key = STORAGE_KEYS.lastPresentationSession,
  maxEvents = 5000,
} = {}) {
  let session = null;

  return {
    start(detail = {}) {
      session = {
        schemaVersion: SCHEMA_VERSION,
        id: `rehearsal-${Date.now()}`,
        recording: true,
        startedAt: new Date().toISOString(),
        events: [],
        ...detail,
      };
      this.record("session_start");
      return session;
    },
    record(type, detail = {}) {
      if (!session?.recording) return false;
      if (session.events.length >= maxEvents) {
        session.events.splice(0, Math.max(1, Math.floor(maxEvents * 0.1)));
        session.truncated = true;
      }
      session.events.push({ type, at: new Date().toISOString(), ...detail });
      return true;
    },
    stop(detail = {}) {
      if (!session) return null;
      this.record("session_stop", detail);
      session.recording = false;
      session.endedAt = new Date().toISOString();
      writeJson(storage, key, session);
      return session;
    },
    getSession: () => session,
    dispose() {
      if (session?.recording) this.stop({ reason: "dispose" });
    },
  };
}
