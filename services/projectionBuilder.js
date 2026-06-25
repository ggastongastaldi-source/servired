/**
 * Projection Builder v1 — ServiRed OS RTMIL v1
 * Reconstruye estado desde eventos WAL
 * Snapshots son estado derivado — nunca fuente de verdad
 */

function createProjections() {
  return {
    users:    {},  // actorId → { actorId, rol, email, registeredAt }
    commerce: {},  // actorId → { actorId, nombre, rubro, zoneId, registeredAt }
    services: {},  // actorId → [{ pedidoId, tipoServicio, zoneId, requestedAt }]
    payments: [],  // [{ actorId, type, amount, paymentId, confirmedAt }]
    boosts:   {},  // actorId → { actorId, paymentId, boostExpiry, purchasedAt }
  };
}

/**
 * applyEvent(projections, entry) — aplica un evento WAL a las proyecciones
 * Función pura — no modifica nada externo
 */
function applyEvent(projections, entry) {
  const { type, actorId, zoneId, payload, timestamp } = entry;

  switch (type) {
    case 'USER_REGISTERED':
      projections.users[actorId] = {
        actorId,
        rol:          payload.rol   || null,
        email:        payload.email || null,
        registeredAt: timestamp
      };
      break;

    case 'COMMERCE_REGISTERED':
      projections.commerce[actorId] = {
        actorId,
        nombre:       payload.nombre || null,
        rubro:        payload.rubro  || null,
        zoneId:       zoneId         || null,
        registeredAt: timestamp
      };
      break;

    case 'SERVICE_REQUESTED':
      if (!projections.services[actorId]) {
        projections.services[actorId] = [];
      }
      projections.services[actorId].push({
        pedidoId:    payload.pedidoId    || null,
        tipoServicio: payload.tipoServicio || null,
        zoneId:      zoneId              || null,
        requestedAt: timestamp
      });
      break;

    case 'PAYMENT_CONFIRMED':
      projections.payments.push({
        actorId,
        type:        'PAYMENT_CONFIRMED',
        amount:      payload.amount    || 0,
        paymentId:   payload.paymentId || null,
        confirmedAt: timestamp
      });
      break;

    case 'BOOST_PURCHASED':
      projections.boosts[actorId] = {
        actorId,
        paymentId:   payload.paymentId  || null,
        boostExpiry: payload.boostExpiry || null,
        purchasedAt: timestamp
      };
      break;
  }

  return projections;
}

/**
 * summarize(projections) — genera resumen ejecutivo
 */
function summarize(projections) {
  const totalPayments = projections.payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const serviceCount  = Object.values(projections.services)
    .reduce((sum, arr) => sum + arr.length, 0);

  return {
    users:         Object.keys(projections.users).length,
    commerce:      Object.keys(projections.commerce).length,
    services:      serviceCount,
    payments:      projections.payments.length,
    boosts:        Object.keys(projections.boosts).length,
    totalRevenueARS: totalPayments
  };
}

module.exports = { createProjections, applyEvent, summarize };
