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
    console.warn(`🩸 [GR3] Heartbeat timeout. Desconectando workerId=${workerId}`);
    await markWorkerOffline(workerId);
    liveConnections.delete(workerId);
  }, HEARTBEAT_TIMEOUT_MS));
}

async function markWorkerOffline(workerId) {
  try {
    await Worker.findOneAndUpdate({ workerId }, { 
      $set: { 'presence.online': false, 'presence.lastSeen': new Date(), 'connection.socketId': null, 'connection.reconnecting': false } 
    });
  } catch (err) { console.error(`🩸 [GR3] Error en markWorkerOffline:`, err.message); }
}

module.exports = function registerWorkerHandlers(io, socket) {
  const clientIp = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

  socket.on('worker:restore-session', async (payload, ack) => {
    const { workerId, reconnectToken, reconnectTokenVersion, runtimeData = {} } = payload || {};
    const now = new Date();

    if (!workerId || !reconnectToken || reconnectTokenVersion == null) {
      return ack?.({ ok: false, reason: 'MISSING_CREDENTIALS' });
    }

    // Filtro de Telemetría Crítica de Entrada (PRUEBA DE FUEGO)
    if (runtimeData.batteryLevel === null || runtimeData.forcedFlags?.includes('TELEMETRY_STALE')) {
      console.warn(`🚨 [GR3] Conexión rechazada para workerId=${workerId}: Telemetría ausente o sucia.`);
      return ack?.({ ok: false, reason: 'TELEMETRY_REJECTED' });
    }

    if (restoreLocks.has(workerId)) {
      if (now.getTime() - restoreLocks.get(workerId) > MUTEX_TIMEOUT_MS) {
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
          await markWorkerOffline(workerId);
          return ack?.({ ok: false, reason: 'TOKEN_VERSION_MISMATCH' });
        }
        return ack?.({ ok: false, reason: 'INVALID_TOKEN_OR_EXPIRED' });
      }

      const oldSocketId = liveConnections.get(workerId);
      if (oldSocketId && oldSocketId !== socket.id) {
        setImmediate(() => { io.sockets.sockets.get(oldSocketId)?.disconnect(true); });
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
            'runtime.appVersion': runtimeData.appVersion,
            'runtime.platform': runtimeData.platform,
            'runtime.batteryLevel': runtimeData.batteryLevel,
            'runtime.networkType': runtimeData.networkType,
            'runtime.gpsAccuracy': runtimeData.gpsAccuracy,
            'runtime.latencyMs': runtimeData.latencyMs,
            'runtime.lastTelemetryAt': now // Sello de frescura temporal
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

      resetHeartbeatTimer(io, workerId, socket.id);
      console.log(`🩸 [GR3] Session Restored con telemetría OK para workerId=${workerId}`);
      
      ack?.({ 
        ok: true, 
        fsmState: updated.fsmState, 
        sessionVersion: updated.connection.sessionVersion,
        reliabilityFlags: updated.reliabilityFlags
      });

    } catch (err) {
      ack?.({ ok: false, reason: 'SERVER_ERROR' });
    } finally {
      restoreLocks.delete(workerId);
    }
  });

  socket.on('worker:heartbeat', async (payload) => {
    const { workerId, telemetry = {} } = payload || {};
    if (!workerId || liveConnections.get(workerId) !== socket.id) {
      socket.disconnect(true);
      return;
    }

    const now = new Date();
    
    // Si el latido viene con telemetría marcada como vieja por el cliente, penalizamos en DB
    const updateFields = { 'presence.lastHeartbeat': now };
    if (telemetry.batteryLevel !== undefined && telemetry.isFresh) {
      updateFields['runtime.batteryLevel'] = telemetry.batteryLevel;
      updateFields['runtime.networkType'] = telemetry.networkType;
      updateFields['runtime.gpsAccuracy'] = telemetry.gpsAccuracy;
      updateFields['runtime.lastTelemetryAt'] = now;
    }

    await Worker.findOneAndUpdate(
      { workerId, 'connection.socketId': socket.id }, 
      { $set: updateFields }
    );
    
    resetHeartbeatTimer(io, workerId, socket.id);
    socket.emit('worker:heartbeat_ack', { timestamp: now });
  });

  socket.on('disconnect', async (reason) => {
    for (const [wId, sId] of liveConnections.entries()) {
      if (sId !== socket.id) continue;
      clearHeartbeatTimer(wId);
      liveConnections.delete(wId);
      
      if (reason === 'transport close' || reason === 'ping timeout') {
        await Worker.findOneAndUpdate({ workerId: wId }, { $set: { 'connection.reconnecting': true } });
      } else {
        await markWorkerOffline(wId);
      }
      break;
    }
  });
};
