'use strict';
/**
 * localCommandQueue.js — Local Event Store + Command Queue (IndexedDB)
 * ServiRed UX Constitution v1.2 — roadmap item 1.
 * v1.1: agrega lastAttemptAt + recoverInterruptedCommands (RFC-UX-002, invariante 6).
 */

(function (global) {
  const DB_NAME = 'servired_local_v1';
  const DB_VERSION = 1;
  const STORE_NAME = 'command_queue';

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'commandId' });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
    return dbPromise;
  }

  function uuid() {
    if (global.crypto && global.crypto.randomUUID) return global.crypto.randomUUID();
    return 'cmd-' + Date.now() + '-' + Math.random().toString(16).slice(2);
  }

  async function enqueueCommand(commandType, payload) {
    const db = await openDB();
    const command = {
      commandId: uuid(),
      commandType,
      payload,
      status: 'pending',
      attempts: 0,
      createdAt: new Date().toISOString(),
      lastAttemptAt: null,
      lastError: null
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).add(command);
      tx.oncomplete = () => { notifyQueueChange(); resolve(command); };
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getCommandsByStatus(status) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const index = tx.objectStore(STORE_NAME).index('status');
      const request = index.getAll(status);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getPendingCommands() {
    const [pending, failed] = await Promise.all([
      getCommandsByStatus('pending'),
      getCommandsByStatus('failed')
    ]);
    return [...pending, ...failed].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async function updateCommandStatus(commandId, status, error) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const getReq = store.get(commandId);
      getReq.onsuccess = () => {
        const command = getReq.result;
        if (!command) return resolve(null);
        command.status = status;
        command.lastError = error || null;
        if (status === 'failed') command.attempts += 1;
        if (status === 'syncing' || status === 'failed') {
          command.lastAttemptAt = new Date().toISOString();
        }
        store.put(command);
      };
      tx.oncomplete = () => { notifyQueueChange(); resolve(true); };
      tx.onerror = () => reject(tx.error);
    });
  }

  async function markSynced(commandId) { return updateCommandStatus(commandId, 'synced'); }
  async function markFailed(commandId, error) { return updateCommandStatus(commandId, 'failed', String(error)); }
  async function markSyncing(commandId) { return updateCommandStatus(commandId, 'syncing'); }

  async function getQueueSize() {
    const pending = await getPendingCommands();
    return pending.length;
  }

  async function recoverInterruptedCommands() {
    const stuck = await getCommandsByStatus('syncing');
    for (const command of stuck) {
      await updateCommandStatus(command.commandId, 'failed', 'interrupted_by_crash_recovery');
    }
    return stuck.length;
  }

  const listeners = new Set();
  function subscribeQueueSize(callback) {
    listeners.add(callback);
    getQueueSize().then(callback);
    return () => listeners.delete(callback);
  }
  function notifyQueueChange() {
    getQueueSize().then((size) => listeners.forEach((cb) => cb(size)));
  }

  global.ServiRedQueue = {
    enqueueCommand,
    getPendingCommands,
    markSynced,
    markFailed,
    markSyncing,
    getQueueSize,
    subscribeQueueSize,
    recoverInterruptedCommands
  };
})(window);
