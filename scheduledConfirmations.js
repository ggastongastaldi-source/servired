// scheduledConfirmations.js — cron para pedidos programados
'use strict';
const schedule = require('node-schedule');
const Pedido   = require('./src/core/models/Pedido');
const Usuario  = require('./src/core/models/Usuario');
const { registrar: timelineRegistrar } = require('./src/core/services/timelineService');

async function chequearTurnos(io) {
  const ahora   = new Date();
  const en24h   = new Date(ahora.getTime() + 24*60*60*1000);
  const en2h    = new Date(ahora.getTime() +  2*60*60*1000);
  const ventana = 5 * 60 * 1000; // ±5 min de tolerancia

  // Pedidos que están a ~24h
  const proximos24 = await Pedido.find({
    scheduledFor: { $gte: new Date(en24h - ventana), $lte: new Date(en24h + ventana) },
    estado: { $in: ['ACEPTADA','PENDIENTE'] },
    confirmacion24h: { $ne: true },
  }).populate('cliente workerAcepto');

  for (const p of proximos24) {
    await Pedido.findByIdAndUpdate(p._id, { confirmacion24h: true });
    const msg = '🔔 Recordatorio: tu turno de ' + p.tipoServicio + ' es mañana.';
    await timelineRegistrar(io, p._id, 'CONFIRMACION_24H', 'sistema', msg,
      { clienteId: String(p.cliente?._id||''), workerId: String(p.workerAcepto?._id||'') }
    ).catch(()=>{});
    // Push a ambos
    if (io) {
      io.to('worker_' + p.cliente?._id).emit('alerta_turno', { tipo: '24h', pedidoId: p._id, mensaje: msg });
      if (p.workerAcepto) io.to('worker_' + p.workerAcepto._id).emit('alerta_turno', { tipo: '24h', pedidoId: p._id, mensaje: msg });
    }
    console.log('[CRON] Confirmación 24h enviada — pedido:', p._id);
  }

  // Pedidos que están a ~2h
  const proximos2 = await Pedido.find({
    scheduledFor: { $gte: new Date(en2h - ventana), $lte: new Date(en2h + ventana) },
    estado: { $in: ['ACEPTADA','PENDIENTE'] },
    confirmacion2h: { $ne: true },
  }).populate('cliente workerAcepto');

  for (const p of proximos2) {
    await Pedido.findByIdAndUpdate(p._id, { confirmacion2h: true });
    const msg = '⏰ Tu turno de ' + p.tipoServicio + ' es en 2 horas. ¡Confirmá tu asistencia!';
    await timelineRegistrar(io, p._id, 'CONFIRMACION_2H', 'sistema', msg,
      { clienteId: String(p.cliente?._id||''), workerId: String(p.workerAcepto?._id||'') }
    ).catch(()=>{});
    if (io) {
      io.to('worker_' + p.cliente?._id).emit('alerta_turno', { tipo: '2h', pedidoId: p._id, mensaje: msg });
      if (p.workerAcepto) io.to('worker_' + p.workerAcepto._id).emit('alerta_turno', { tipo: '2h', pedidoId: p._id, mensaje: msg });
    }
    console.log('[CRON] Confirmación 2h enviada — pedido:', p._id);
  }
}

function iniciar(io) {
  // Correr cada 5 minutos
  schedule.scheduleJob('*/5 * * * *', () => chequearTurnos(io).catch(e => console.error('[CRON]', e.message)));
  console.log('[CRON] scheduledConfirmations activo — check cada 5 min');
}

module.exports = { iniciar, chequearTurnos };
