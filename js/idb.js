/**
 * idb.js - IndexedDB Promise Wrapper
 * オフライン環境やエラー時でも止まらない堅牢なIndexedDBラッパー
 */

export function openDB(name, version, { upgrade } = {}) {
  return new Promise((resolve) => {
    // タイムアウト安全装置 (3秒で応答がなければインメモリDB互換オブジェクトを返す)
    const timeout = setTimeout(() => {
      console.warn(`[idb] データベース "${name}" のオープンがタイムアウトしました。フォールバックします。`);
      resolve(createInMemoryDB());
    }, 3000);

    try {
      if (typeof indexedDB === "undefined") {
        clearTimeout(timeout);
        return resolve(createInMemoryDB());
      }

      const request = indexedDB.open(name, version);

      request.onerror = (e) => {
        clearTimeout(timeout);
        console.warn(`[idb] データベースオープンエラー (${name}):`, e);
        resolve(createInMemoryDB());
      };

      request.onsuccess = () => {
        clearTimeout(timeout);
        resolve(wrapDatabase(request.result));
      };

      request.onupgradeneeded = (event) => {
        const db = request.result;
        const upgradeContext = {
          createObjectStore(storeName, options) {
            try {
              if (db.objectStoreNames.contains(storeName)) {
                return {
                  createIndex() {},
                };
              }
              const store = db.createObjectStore(storeName, options);
              return {
                createIndex(idxName, keyPath, idxOptions) {
                  try {
                    return store.createIndex(idxName, keyPath, idxOptions);
                  } catch (_) {
                    return null;
                  }
                },
              };
            } catch (err) {
              console.warn("createObjectStore error:", err);
              return { createIndex() {} };
            }
          },
        };

        if (typeof upgrade === "function") {
          try {
            upgrade(upgradeContext, event.oldVersion, event.newVersion);
          } catch (err) {
            console.warn("upgrade callback error:", err);
          }
        }
      };
    } catch (err) {
      clearTimeout(timeout);
      console.warn("indexedDB.open例外:", err);
      resolve(createInMemoryDB());
    }
  });
}

function wrapDatabase(db) {
  return {
    async getAll(storeName) {
      return new Promise((resolve) => {
        try {
          if (!db.objectStoreNames.contains(storeName)) {
            return resolve([]);
          }
          const tx = db.transaction(storeName, "readonly");
          const store = tx.objectStore(storeName);
          const req = store.getAll();
          req.onsuccess = () => resolve(req.result || []);
          req.onerror = () => resolve([]);
        } catch (e) {
          console.warn(`getAll(${storeName}) エラー:`, e);
          resolve([]);
        }
      });
    },

    async add(storeName, value) {
      return new Promise((resolve) => {
        try {
          if (!db.objectStoreNames.contains(storeName)) {
            return resolve(1);
          }
          const tx = db.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          const req = store.add(value);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(1);
        } catch (e) {
          console.warn(`add(${storeName}) エラー:`, e);
          resolve(1);
        }
      });
    },

    async put(storeName, value) {
      return new Promise((resolve) => {
        try {
          if (!db.objectStoreNames.contains(storeName)) {
            return resolve(value);
          }
          const tx = db.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          const req = store.put(value);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(value);
        } catch (e) {
          console.warn(`put(${storeName}) エラー:`, e);
          resolve(value);
        }
      });
    },

    async clear(storeName) {
      return new Promise((resolve) => {
        try {
          if (!db.objectStoreNames.contains(storeName)) {
            return resolve();
          }
          const tx = db.transaction(storeName, "readwrite");
          const store = tx.objectStore(storeName);
          const req = store.clear();
          req.onsuccess = () => resolve();
          req.onerror = () => resolve();
        } catch (e) {
          resolve();
        }
      });
    },

    async getFromIndex(storeName, indexName, key) {
      return new Promise((resolve) => {
        try {
          if (!db.objectStoreNames.contains(storeName)) {
            return resolve(null);
          }
          const tx = db.transaction(storeName, "readonly");
          const store = tx.objectStore(storeName);
          const index = store.index(indexName);
          const req = index.get(key);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        } catch (e) {
          resolve(null);
        }
      });
    },

    close() {
      try { db.close(); } catch (_) {}
    },
  };
}

/**
 * IndexedDBが利用できない環境用のインメモリフォールバック
 */
function createInMemoryDB() {
  const storage = new Map();
  return {
    async getAll(storeName) {
      return storage.get(storeName) || [];
    },
    async add(storeName, value) {
      const list = storage.get(storeName) || [];
      const item = { id: list.length + 1, ...value };
      list.push(item);
      storage.set(storeName, list);
      return item.id;
    },
    async put(storeName, value) {
      const list = storage.get(storeName) || [];
      const idx = list.findIndex((i) => i.id === value.id);
      if (idx >= 0) list[idx] = value;
      else list.push(value);
      storage.set(storeName, list);
      return value;
    },
    async clear(storeName) {
      storage.set(storeName, []);
    },
    async getFromIndex(storeName, indexName, key) {
      const list = storage.get(storeName) || [];
      return list.find((i) => i[indexName] === key) || null;
    },
    close() {},
  };
}
