export function openDatabase({ name, version = 1, upgrade, indexedDB: indexedDb = globalThis.indexedDB }) {
  return new Promise((resolve, reject) => {
    if (!indexedDb) {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const request = indexedDb.open(name, version);
    request.onupgradeneeded = () => upgrade?.(request.result, request.transaction);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function runTransaction(db, storeName, mode, action) {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const request = action(transaction.objectStore(storeName));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}
