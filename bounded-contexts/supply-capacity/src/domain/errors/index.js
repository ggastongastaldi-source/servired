'use strict';
class OfferNotActiveError extends Error {
  constructor(offerId, status) { super(`Oferta ${offerId} no está ACTIVE (estado: ${status})`); this.name = 'OfferNotActiveError'; }
}
class InsufficientCapacityError extends Error {
  constructor(available, requested) { super(`Capacidad insuficiente: disponible ${available}, solicitado ${requested}`); this.name = 'InsufficientCapacityError'; }
}
module.exports = { OfferNotActiveError, InsufficientCapacityError };
