'use strict';
const Payment = require('../models/Payment');

/**
 * SFS-MIRROR — Shadow Mode
 * Append-only. Nunca modifica Pedido. Falla silenciosamente.
 */
async function registrarEventoEspejo(pedidoId, eventoData) {
  try {
    const doc = {
      correlationId:        String(pedidoId),
      amount:               eventoData.monto || 0,
      currency:             'ARS',
      status:               eventoData.toState === 'PAID' ? 'APPROVED' : 'PENDING',
      externalReference:    String(pedidoId),
      paymentId:            eventoData.mercadoPagoPaymentId || null,
      rawWebhook:           {
        tipo:              eventoData.tipo,
        fromState:         eventoData.fromState,
        toState:           eventoData.toState,
        metadata:          eventoData.metadata || {},
        eventoTimestamp:   eventoData.eventoTimestamp || new Date(),
        version:           1,
      },
      approvedAt: eventoData.toState === 'PAID' ? new Date() : undefined,
    };
    await Payment.create(doc);
    console.log(`[SFS-MIRROR] ✅ Evento registrado | pedido:${pedidoId} | ${eventoData.fromState}->${eventoData.toState}`);
  } catch(e) {
    if (e.code === 11000) {
      console.log(`[SFS-MIRROR] Duplicado ignorado | pedido:${pedidoId}`);
    } else {
      console.error(`[SFS-MIRROR] Error (no crítico):`, e.message);
    }
    return null;
  }
}

module.exports = { registrarEventoEspejo };
