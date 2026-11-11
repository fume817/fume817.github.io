/**
 * idb.js - IndexedDB Promise Wrapper
 * オフライン環境でも動作する軽量互換ライブラリ
 */

export function openDB(name, version, { upgrade } = {}) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => {
      resolve(wrapDatabase(request.result));
    };

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const upgradeContext = {
        createObjectStore(storeName, options) {
          const store = db.createObjectStore(storeName, options);
          return {
            createIndex(idxName, keyPath, idxOptions) {
              return store.createIndex(idxName, keyPath, idxOptions);
            },
          };
        },
      };

      if (typeof upgrade === "function") {
        upgrade(upgradeContext, event.oldVersion, event.newVersion);
      }
    };
  });
}

function wrapDatabase(db) {
  return {
    async getAll(storeName) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    async add(storeName, value) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.add(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    async put(storeName, value) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.put(value);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    async clear(storeName) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readwrite");
        const store = tx.objectStore(storeName);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    },

    async getFromIndex(storeName, indexName, key) {
      return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, "readonly");
        const store = tx.objectStore(storeName);
        const index = store.index(indexName);
        const req = index.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    },

    close() {
      db.close();
    },
  };
}

