'use strict';

const Worker = require('../models/worker.model');
const crypto = require('crypto');
const sha256 = (str) => crypto.createHash('sha256').update(str).digest('hex');

const liveConnections = new Map();
const restoreLocks    = new Map();
const heartbeatTimers = new Map();
const HEARTBEAT_TIMEOUT_MS = 35000;
const MUTEX_TIMEOUT_MS = 5000;

function clearHeartbeatTimer(workerId) {
  if (heartbeatTimers.has(workerId)) {
    clearTimeout(heartbeatTimers.get(workerId));
    heartbeatTimers.delete(workerId);
  }
}

function resetHeartbeatTimer(io, workerId, socketId) {
  clearHeartbeatTimer(workerId);
  heartbeatTimers.set(workerId, setTimeout(async () => {
    if (liveConnections.get(workerId) !== socketId) return;
    console.warn(`🩸 [GR3] Heartbeat timeout para workerId=${workerId}`);
    await markWorkerOffline(workerId);
    liveConnections.delete(workerId);
  }, HEARTBEAT_TIMEOUT_MS));
}

async function markWorkerOffline(workerId) {
  try {
    await Worker.findOneAndUpdate({ workerId }, { 
      $set: { 
        'presence.online': false, 
        'presence.lastSeen': new Date(), 
        'connection.socketId': null,
        'connection.reconnecting': false
      } 
    });
    console.log(`🩸 [GR3] Worker offline persistido en DB workerId=${workerId}`);
  } catch (err) { 
    console.error(`🩸 [GR3] Error en markWorkerOffline:`, err.message); 
  }
}

module.exports = function registerWorkerHandlers(io, socket) {
  const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

  socket.on('worker:restore-session', async (payload, ack) => {
    const { workerId, reconnectToken, reconnectTokenVersion, runtimeData = {} } = payload || {};
    const now = new Date();

    if (!workerId || !reconnectToken || reconnectTokenVersion == null) {
      return ack?.({ ok: false, reason: 'MISSING_CREDENTIALS' });
    }

    if (restoreLocks.has(workerId)) {
      const lockTime = restoreLocks.get(workerId);
      if (now.getTime() - lockTime > MUTEX_TIMEOUT_MS) {
        console.warn(`🩸 [GR3] Mutex Timeout forzado para workerId=${workerId}. Liberando lock.`);
        restoreLocks.delete(workerId);
      } else {
        return ack?.({ ok: false, reason: 'RESTORE_IN_PROGRESS' });
      }
    }
    
    restoreLocks.set(workerId, now.getTime());

    try {
      const hash = sha256(reconnectToken);
      const worker = await Worker.verifyReconnectToken(workerId, reconnectToken, reconnectTokenVersion);
      
      if (!worker) {
        const checkWorker = await Worker.findOne({ workerId });
        if (checkWorker && checkWorker.auth.reconnectTokenVersion !== reconnectTokenVersion) {
          console.error(`🚨 [GR3] CRÍTICO: Token version mismatch detectado en workerId=${workerId}. Posible ataque o duplicado extremo. Invalidando sesión.`);
          await markWorkerOffline(workerId);
          return ack?.({ ok: false, reason: 'TOKEN_VERSION_MISMATCH' });
        }
        return ack?.({ ok: false, reason: 'INVALID_TOKEN_OR_EXPIRED' });
      }

      const oldSocketId = liveConnections.get(workerId);
      if (oldSocketId && oldSocketId !== socket.id) {
        console.log(`🩸 [GR3] Ejecting zombie socket=${oldSocketId} para workerId=${workerId}`);
        setImmediate(() => {
          io.sockets.sockets.get(oldSocketId)?.disconnect(true);
        });
      }

      const updated = await Worker.findOneAndUpdate(
        { workerId, 'auth.reconnectTokenHash': hash },
        {
          $inc: { 'connection.sessionVersion': 1 },
          $set: {
            'connection.socketId': socket.id,
            'connection.connectedAt': now,
            'connection.reconnecting': false,
            'presence.online': true,
            'presence.lastHeartbeat': now,
            'auth.lastRestoreAt': now,
            'auth.lastRestoreIp': clientIp,
            'auth.lastRestoreUserAgent': runtimeData.userAgent || null,
            'auth.lastRestoreNetworkType': runtimeData.networkType || null,
            'runtime.appVersion': runtimeData.appVersion || null,
            'runtime.platform': runtimeData.platform || null,
            'runtime.batteryLevel': runtimeData.batteryLevel ?? null,
            'runtime.networkType': runtimeData.networkType || null,
            'runtime.gpsAccuracy': runtimeData.gpsAccuracy ?? null,
            'runtime.latencyMs': runtimeData.latencyMs ?? null
          },
        },
        { new: true }
      );

      if (!updated) return ack?.({ ok: false, reason: 'INTERNAL_ERROR' });

      liveConnections.set(workerId, socket.id);
      socket.join(`worker:${workerId}`);

      if (updated.dispatch.zona && updated.dispatch.rubros?.length) {
        for (const rubro of updated.dispatch.rubros) {
          socket.join(`despacho:${updated.dispatch.zona}:${rubro}`);
        }
      }

      if (updated.dispatch.currentJobId) {
        const jobRoom = `pedido:${updated.dispatch.currentJobId}`;
        socket.join(jobRoom);
        io.to(jobRoom).emit('worker:back_online', { 
          workerId, 
          socketId: socket.id, 
          sessionVersion: updated.connection.sessionVersion, 
          timestamp: now 
        });
      }

      resetHeartbeatTimer(io, workerId, socket.id);
      
      const flags = updated.reliabilityFlags;
      
      io.emit('gr3:session-restored', { 
        workerId, 
        socketId: socket.id, 
        fsmState: updated.fsmState, 
        reliabilityFlags: flags,
        timestamp: now 
      });

      io.emit('worker_conectado', { workerId, socketId: socket.id, deprecated: true });

      console.log(`🩸 [GR3] Restore OK workerId=${workerId} v=${updated.connection.sessionVersion} fsm=${updated.fsmState}`);
      
      ack?.({ 
        ok: true, 
        fsmState: updated.fsmState, 
        sessionVersion: updated.connection.sessionVersion, 
        reliabilityFlags: flags, 
        currentJobId: updated.dispatch.currentJobId || null 
      });

    } catch (err) {
      console.error(`🩸 [GR3] Error crítico en restore-session workerId=${workerId}:`, err.message);
      ack?.({ ok: false, reason: 'SERVER_ERROR', detail: err.message });
    } finally {
      restoreLocks.delete(workerId);
    }
  });

  socket.on('worker:heartbeat', async (payload) => {
    const { workerId } = payload || {};
    if (!workerId) return;
    
    if (liveConnections.get(workerId) !== socket.id) { 
      console.warn(`🩸 [GR3] Heartbeat rechazado para socket no emparejado. Forzando desconexión.`);
      socket.disconnect(true); 
      return; 
    }

    const now = new Date();
    await Worker.findOneAndUpdate({ workerId, 'connection.socketId': socket.id }, { $set: { 'presence.lastHeartbeat': now } });
    resetHeartbeatTimer(io, workerId, socket.id);
    socket.emit('worker:heartbeat_ack', { timestamp: now });
  });

  socket.on('disconnect', async (reason) => {
    for (const [wId, sId] of liveConnections.entries()) {
      if (sId !== socket.id) continue;
      console.log(`🩸 [GR3] Disconnect de socket de transporte workerId=${wId} por razón=${reason}`);
      clearHeartbeatTimer(wId);
      liveConnections.delete(wId);
      
      if (reason === 'transport close' || reason === 'ping timeout') {
        await Worker.findOneAndUpdate({ workerId: wId }, { $set: { 'connection.reconnecting': true } });
        console.log(`🩸 [GR3] Tránsito FSM intermedio: Worker ${wId} seteado en RECONECTANDO.`);
      } else {
        await markWorkerOffline(wId);
      }
      break;
    }
  });
};
