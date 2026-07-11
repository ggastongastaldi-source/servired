'use strict';

const { randomUUID } = require('crypto');

function crearEvento(type, aggregateId, payload = {}) {
  return Object.freeze({
    eventId:     randomUUID(),
    type,
    aggregateId,
    occurredAt:  new Date(),
    payload
  });
}

const PedidoDomainEvents = {
  pedidoCreado:   (id, p) => crearEvento('PedidoCreado',   id, p),
  pedidoAsignado: (id, p) => crearEvento('PedidoAsignado', id, p),
  trabajoIniciado:(id, p) => crearEvento('TrabajoIniciado',id, p),
  trabajoFinalizado:(id,p)=> crearEvento('TrabajoFinalizado',id,p),
  pedidoCancelado:(id, p) => crearEvento('PedidoCancelado', id, p),
  pagoLiberado:   (id, p) => crearEvento('PagoLiberado',    id, p),
};

module.exports = { PedidoDomainEvents };
