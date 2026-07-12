'use strict';

/**
 * PedidoProjectionReactor
 *
 * Consume un DomainEvent { type: 'PedidoCreado', aggregateId, payload }
 * y materializa el documento Pedido legacy en MongoDB.
 *
 * Responsabilidad única: traducir el evento de dominio al modelo Mongoose.
 * No contiene reglas de negocio. No emite nuevos eventos.
 *
 * Lazy-require de Mongoose para no romper tests unitarios.
 */

const UBICACION_DEFAULT = { type: 'Point', coordinates: [-58.4, -34.6] };

function getModel() {
  return require('../../core/models/Pedido');
}

/**
 * @param {object} domainEvent  — evento emitido por Pedido.crear()
 * @returns {Promise<object>}   — documento Pedido guardado (lean)
 */
async function proyectarPedido(domainEvent) {
  if (domainEvent.type !== 'PedidoCreado') {
    throw new Error(`PedidoProjectionReactor: evento inesperado "${domainEvent.type}"`);
  }

  const p = domainEvent.payload;
  const Model = getModel();

  const ubicacion = (p.ubicacion?.lat != null && p.ubicacion?.lng != null)
    ? { type: 'Point', coordinates: [p.ubicacion.lng, p.ubicacion.lat] }
    : UBICACION_DEFAULT;

  const doc = await new Model({
    jobId:         domainEvent.aggregateId,   // puente UUID ↔ ObjectId
    cliente:       p.clienteId,
    tipoServicio:  p.tipoServicio,
    zona:          p.zona,
    descripcion:   p.descripcion  ?? '',
    direccion:     p.direccion    ?? '',
    complejidad:   p.complejidad  ?? 'baja',
    precio:        p.precio,
    total_estimado:p.precio,
    pago_worker:   p.pagoWorker,
    estado:        'PENDIENTE',
    ubicacion,
    fechaCreacion: new Date(),
  }).save();

  return doc.toObject();
}

module.exports = { proyectarPedido };
