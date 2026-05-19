const Worker = require('../models/worker.model');
const crypto = require('crypto');
const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

const liveConnections = new Map();
const restoreLocks    = new Set();
const heartbeatTimers = new Map();
const HEARTBEAT_TIMEOUT_MS = 35000;

function clearHeartbeatTimer(workerId) {
  if (heartbeatTimers.has(workerId)) { clearTimeout(heartbeatTimers.get(workerId)); heartbeatTimers.delete(workerId); }
}

function resetHeartbeatTimer(io, workerId, socketId) {
  clearHeartbeatTimer(workerId);
  heartbeatTimers.set(workerId, setTimeout(async () => {
    if (liveConnections.get(workerId) !== socketId) return;
    console.warn(`[GR3] Heartbeat timeout workerId=${workerId}`);
    await markWorkerOffline(workerId);
    liveConnections.delete(workerId);
  }, HEARTBEAT_TIMEOUT_MS));
}

async function markWorkerOffline(workerId) {
  try {
    await Worker.findOneAndUpdate({ workerId }, { $set: { 'presence.online': false, 'presence.lastSeen': new Date(), 'connection.socketId': null } });
    console.log(`[GR3] Worker offline workerId=${workerId}`);
  } catch (err) { console.error(`[GR3] markWorkerOffline error:`, err.message); }
}

module.exports = function registerWorkerHandlers(io, socket) {
  const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

  socket.on('worker:restore-session', async (payload, ack) => {
    const { workerId, reconnectToken, runtimeData = {} } = payload || {};
    if (!workerId || !reconnectToken) return ack?.({ ok: false, reason: 'MISSING_CREDENTIALS' });
    if (restoreLocks.has(workerId))   return ack?.({ ok: false, reason: 'RESTORE_IN_PROGRESS' });
    restoreLocks.add(workerId);
    try {
      const hash   = sha256(reconnectToken);
      const worker = await Worker.findOne({ workerId, 'auth.reconnectTokenHash': hash }, '+auth.reconnectTokenHash +auth.reconnectTokenExpiresAt');
      if (!worker) return ack?.({ ok: false, reason: 'INVALID_TOKEN' });
      if (!worker.auth.reconnectTokenExpiresAt || worker.auth.reconnectTokenExpiresAt < new Date()) return ack?.({ ok: false, reason: 'TOKEN_EXPIRED' });

      const oldSocketId = liveConnections.get(workerId);
      if (oldSocketId && oldSocketId !== socket.id) {
        console.log(`[GR3] Ejecting zombie socket=${oldSocketId} workerId=${workerId}`);
        io.sockets.sockets.get(oldSocketId)?.disconnect(true);
      }

      const now     = new Date();
      const updated = await Worker.findOneAndUpdate(
        { workerId, 'auth.reconnectTokenHash': hash },
        {
          $inc: { 'connection.sessionVersion': 1 },
          $set: {
            'connection.socketId': socket.id, 'connection.connectedAt': now,
            'presence.online': true, 'presence.lastHeartbeat': now,
            'auth.lastRestoreAt': now, 'auth.lastRestoreIp': clientIp,
            'auth.lastRestoreUserAgent': runtimeData.userAgent || null,
            'auth.lastRestoreNetworkType': runtimeData.networkType || null,
            'runtime.appVersion': runtimeData.appVersion || null,
            'runtime.platform': runtimeData.platform || null,
            'runtime.batteryLevel': runtimeData.batteryLevel ?? null,
            'runtime.networkType': runtimeData.networkType || null,
            'runtime.gpsAccuracy': runtimeData.gpsAccuracy ?? null,
          },
        },
        { new: true }
      );
      if (!updated) return ack?.({ ok: false, reason: 'INTERNAL_ERROR' });

      liveConnections.set(workerId, socket.id);
      socket.join(`worker:${workerId}`);

      if (updated.dispatch.zona && updated.dispatch.rubros?.length) {
        for (const rubro of updated.dispatch.rubros) {
          const room = `despacho:${updated.dispatch.zona}:${rubro}`;
          socket.join(room);
          console.log(`[GR3] Joined ${room}`);
        }
      }

      if (updated.dispatch.currentJobId) {
        const jobRoom = `pedido:${updated.dispatch.currentJobId}`;
        socket.join(jobRoom);
        io.to(jobRoom).emit('worker:back_online', { workerId, socketId: socket.id, sessionVersion: updated.connection.sessionVersion, timestamp: now });
        console.log(`[GR3] Worker back in ${jobRoom}`);
      }

      resetHeartbeatTimer(io, workerId, socket.id);
      const flags = updated.reliabilityFlags;
      if (flags.length) console.warn(`[GR3] ReliabilityFlags ${workerId}:`, flags);
      console.log(`[GR3] Restore OK workerId=${workerId} v=${updated.connection.sessionVersion} fsm=${updated.fsmState}`);
      ack?.({ ok: true, fsmState: updated.fsmState, sessionVersion: updated.connection.sessionVersion, reliabilityFlags: flags, currentJobId: updated.dispatch.currentJobId || null });
    } catch (err) {
      console.error(`[GR3] Error restore-session workerId=${workerId}:`, err.message);
      ack?.({ ok: false, reason: 'SERVER_ERROR', detail: err.message });
    } finally {
      restoreLocks.delete(workerId);
    }
  });

  socket.on('worker:heartbeat', async ({ workerId } = {}) => {
    if (!workerId) return;
    if (liveConnections.get(workerId) !== socket.id) { socket.disconnect(true); return; }
    const now = new Date();
    await Worker.findOneAndUpdate({ workerId, 'connection.socketId': socket.id }, { $set: { 'presence.lastHeartbeat': now } });
    resetHeartbeatTimer(io, workerId, socket.id);
    socket.emit('worker:heartbeat_ack', { timestamp: now });
  });

  socket.on('disconnect', async (reason) => {
    for (const [wId, sId] of liveConnections.entries()) {
      if (sId !== socket.id) continue;
      console.log(`[GR3] Disconnect workerId=${wId} reason=${reason}`);
      clearHeartbeatTimer(wId);
      liveConnections.delete(wId);
      await markWorkerOffline(wId);
      break;
    }
  });
};
