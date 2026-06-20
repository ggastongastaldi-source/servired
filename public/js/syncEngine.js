'use strict';
/**
 * syncEngine.js — Sync Engine v1.0 (RFC-UX-002)
 * ServiRed UX Constitution v1.2 — roadmap item 2.
 */

(function (global) {
  const BACKOFF_SCHEDULE_MS = [0, 5000, 15000, 30000, 60000];
  const SYNC_ENDPOINT = '/api/sync/command';

  let syncInProgress = false;

  function getBackoffDelay(attempts) {
    const index = Math.min(attempts, BACKOFF_SCHEDULE_MS.length - 1);
    return BACKOFF_SCHEDULE_MS[index];
  }

  async function sendCommand(command) {
    const response = await fetch(SYNC_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commandId: command.commandId,
        commandType: command.commandType,
        payload: command.payload,
        createdAt: command.createdAt
      })
    });
    if (!response.ok) throw new Error(`Sync fallo (HTTP ${response.status})`);
    return response.json();
  }

  async function processQueue() {
    if (syncInProgress) return;
    if ('onLine' in navigator && navigator.onLine === false) return;

    syncInProgress = true;
    try {
      const pending = await global.ServiRedQueue.getPendingCommands();
      for (const command of pending) {
        const delay = getBackoffDelay(command.attempts);
        const elapsed = command.lastAttemptAt
          ? Date.now() - new Date(command.lastAttemptAt).getTime()
          : Infinity;
        if (delay > 0 && elapsed < delay) continue;

        await global.ServiRedQueue.markSyncing(command.commandId);
        try {
          await sendCommand(command);
          await global.ServiRedQueue.markSynced(command.commandId);
        } catch (err) {
          await global.ServiRedQueue.markFailed(command.commandId, err.message || String(err));
        }
      }
    } finally {
      syncInProgress = false;
    }
  }

  async function startAutoSync() {
    const recovered = await global.ServiRedQueue.recoverInterruptedCommands();
    if (recovered > 0) console.warn(`[SyncEngine] ${recovered} comando(s) recuperados tras interrupcion`);
    window.addEventListener('online', processQueue);
    setInterval(processQueue, 10000);
    processQueue();
  }

  global.ServiRedSync = { processQueue, startAutoSync, getBackoffDelay };
})(window);
