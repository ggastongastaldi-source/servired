'use strict';

/**
 * ServiRed OS — NotificationService
 * Escucha eventos del dominio → despacha via Socket.IO.
 * Usa los mismos patrones de rooms que el sistema existente:
 *   worker_<id>  →  io.to('worker_' + id)
 *   pedido_<id>  →  io.to('pedido_' + id)
 * No muta estado. Solo observa y reacciona.
 */

const SUBSCRIPTIONS = [
  { type: 'QUOTE_SENT',    room: p => 'worker_' + p.workerId,  event: 'notification', msg: p => ({ text: 'Recibiste un presupuesto nuevo', quoteId: p.quoteId }) },
  { type: 'QUOTE_SELECTED',     room: p => 'worker_' + p.workerId,  event: 'notification', msg: p => ({ text: 'Te seleccionaron para un trabajo', quoteId: p.quoteId }) },
  { type: 'QUOTE_REJECTED',     room: p => 'worker_' + p.workerId,  event: 'notification', msg: p => ({ text: 'Tu presupuesto no fue seleccionado', quoteId: p.quoteId }) },
  { type: 'SERVICE_COMPLETED',  room: p => 'pedido_' + p.pedidoId,  event: 'notification', msg: p => ({ text: 'El servicio fue completado' }) },
  { type: 'WORKER_ACTIVATED',   room: p => 'worker_' + p.workerId,  event: 'notification', msg: p => ({ text: 'Tu cuenta está activa. Ya podés recibir trabajos.' }) },
  { type: 'PAYMENT_COLLECTED',  room: p => 'worker_' + p.workerId,  event: 'notification', msg: p => ({ text: 'Recibiste un pago', amount: p.amount }) },
];

class NotificationService {
  constructor(io) {
    this.name   = 'NotificationService';
    this._io    = io;
    this._unsub = null;
  }

  async start(bus) {
    const types = SUBSCRIPTIONS.map(s => s.type);
    this._unsub = bus.on(types, event => this._handle(event));
  }

  async stop() {
    if (this._unsub) this._unsub();
  }

  _handle(event) {
    if (!this._io) return;
    const sub = SUBSCRIPTIONS.find(s => s.type === event.type);
    if (!sub) return;

    const p = event.payload || {};
    try {
      const room = sub.room(p);
      const msg  = { ...sub.msg(p), eventType: event.type, ts: Date.now() };
      if (room && !room.endsWith('undefined')) {
        this._io.to(room).emit(sub.event, msg);
        console.log(`[Notifications] → ${event.type} @ ${room}`);
      }
    } catch (err) {
      console.error('[Notifications] error:', err.message);
    }
  }
}

module.exports = NotificationService;
