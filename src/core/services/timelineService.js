'use strict';
const TimelineEvent = require('../models/TimelineEvent');

// Registra un hito y lo emite por socket al room del pedido
async function registrar(io, pedidoId, tipo, actor, mensaje, metadata, rtgRegime) {
  const ev = await TimelineEvent.create({ 
    pedidoId, tipo, actor, mensaje: mensaje || '', 
    metadata: metadata || {}, rtgRegime: rtgRegime || null 
  });
  
  const payload = {
    tipo, actor, mensaje: ev.mensaje,
    metadata: ev.metadata, ts: ev.ts,
    rtgRegime: ev.rtgRegime,
  };
  
  if (io) {
    io.to('pedido_' + pedidoId).emit('timeline_event', payload);
    // También emitir a cliente/worker por si no están en el room
    if (metadata?.clienteId) io.to('worker_' + metadata.clienteId).emit('timeline_event', { pedidoId, ...payload });
    if (metadata?.workerId)  io.to('worker_' + metadata.workerId).emit('timeline_event', { pedidoId, ...payload });
  }
  
  return ev;
}

// Devuelve la línea de tiempo completa de un pedido
async function obtener(pedidoId) {
  return TimelineEvent.find({ pedidoId }).sort({ ts: 1 }).lean();
}

module.exports = { registrar, obtener };
