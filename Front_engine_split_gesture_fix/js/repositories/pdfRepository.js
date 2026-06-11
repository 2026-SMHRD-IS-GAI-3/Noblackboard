import { DATABASES, SCHEMA_VERSION } from "../core/constants.js";
import { openDatabase, runTransaction } from "../core/idb.js";

export function createPdfRepository({ indexedDB: indexedDbOverride } = {}) {
  const memory = new Map();
  let fallback = false;

  async function getDb() {
    if (fallback) return null;
    try {
      return await openDatabase({
        name: DATABASES.pdf.name,
        version: DATABASES.pdf.version,
        indexedDB: indexedDbOverride,
        upgrade(db) {
          if (!db.objectStoreNames.contains(DATABASES.pdf.store)) {
            db.createObjectStore(DATABASES.pdf.store, { keyPath: "id" });
          }
        },
      });
    } catch (error) {
      fallback = true;
      console.warn("AirNote PDF repository: using memory fallback.", error);
      return null;
    }
  }

  function rememberFallbackRecord(record) {
    fallback = true;
    memory.set(record.id, record);
    return record;
  }

  return {
    async put(record) {
      const payload = { schemaVersion: SCHEMA_VERSION, ...record };
      const db = await getDb();
      if (!db) {
        return rememberFallbackRecord(payload);
      }
      try {
        await runTransaction(db, DATABASES.pdf.store, "readwrite", (store) => store.put(payload));
      } catch (error) {
        console.warn("AirNote PDF repository: PDF save fell back to memory.", error);
        return rememberFallbackRecord(payload);
      }
      return payload;
    },
    async get(id) {
      const db = await getDb();
      if (!db) return memory.get(id) || null;
      try {
        return await runTransaction(db, DATABASES.pdf.store, "readonly", (store) => store.get(id));
      } catch (error) {
        fallback = true;
        console.warn("AirNote PDF repository: PDF read fell back to memory.", error);
        return memory.get(id) || null;
      }
    },
    async getAll() {
      const db = await getDb();
      if (!db) return Array.from(memory.values());
      try {
        return await runTransaction(db, DATABASES.pdf.store, "readonly", (store) => store.getAll());
      } catch (error) {
        fallback = true;
        console.warn("AirNote PDF repository: PDF list fell back to memory.", error);
        return Array.from(memory.values());
      }
    },
    async delete(id) {
      const db = await getDb();
      if (!db) return memory.delete(id);
      try {
        await runTransaction(db, DATABASES.pdf.store, "readwrite", (store) => store.delete(id));
      } catch (error) {
        fallback = true;
        console.warn("AirNote PDF repository: PDF delete fell back to memory.", error);
        return memory.delete(id);
      }
      return true;
    },
    isFallback() {
      return fallback;
    },
  };
}
