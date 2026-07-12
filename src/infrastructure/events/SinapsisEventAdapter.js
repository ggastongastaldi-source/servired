'use strict';

/**
 * SinapsisEventAdapter
 *
 * Traduce PedidoDomainEvents (dominio puro) al contrato de
 * nexus/events/emitEvent.js (infraestructura existente).
 *
 * Dependencias:
 *   - Dominio: conoce la forma de PedidoDomainEvent
 *   - Infra:   conoce emitEvent() de Nexus
 *
 * El aggregate y los casos de uso NO conocen este adaptador.
 */

// Lazy-require: evita cargar Mongoose/Nexus en contexto de tests unitarios
function getNexusEmit() {
  return require('../../../nexus/events/emitEvent').emitEvent;
}

// Mapeo tipo dominio → tipo SINAPSIS (uppercase, snake_case)
const TIPO_MAP = {
  JobCreated:        'JOB_CREATED',
  PedidoCreado:      'PEDIDO_CREADO',
  PedidoAsignado:    'PEDIDO_ASIGNADO',
  TrabajoIniciado:   'TRABAJO_INICIADO',
  TrabajoFinalizado: 'TRABAJO_FINALIZADO',
  PedidoCancelado:   'PEDIDO_CANCELADO',
  PagoLiberado:      'PAGO_LIBERADO',
};

/**
 * Publica un array de PedidoDomainEvents en el bus SINAPSIS.
 *
 * @param {object[]} domainEvents  - eventos del aggregate (pedido.eventos)
 * @param {object}   [ctx]         - contexto opcional { correlationId, causationId, rootCauseId }
 */
function publicarEventosDePedido(domainEvents, ctx = {}) {
  if (!Array.isArray(domainEvents) || domainEvents.length === 0) return;

  const emitEvent = getNexusEmit();

  for (const de of domainEvents) {
    const tipoSinapsis = TIPO_MAP[de.type];

    if (!tipoSinapsis) {
      console.warn(`[SinapsisEventAdapter] tipo no mapeado: ${de.type} — omitido`);
      continue;
    }

    emitEvent({
      entityType:    'pedido',
      type:          tipoSinapsis,
      aggregateId:   String(de.aggregateId),
      payload:       de.payload ?? {},
      correlationId: ctx.correlationId ?? null,
      causationId:   de.eventId,        // el eventId del dominio es la causa
      rootCauseId:   ctx.rootCauseId ?? null,
    });
  }
}

module.exports = { publicarEventosDePedido };
