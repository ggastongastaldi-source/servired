'use strict';
/**
 * EconomicSignal — impulso económico registrado en el territorio.
 * Representa un hecho observable que modifica el estado del snapshot.
 *
 * Metáfora: impulso neuronal en la Red Neuronal Socioeconómica.
 */
const SIGNAL_TYPES = Object.freeze([
  'SUPPLY_OFFER_ACTIVATED',
  'SUPPLY_OFFER_WITHDRAWN',
  'SUPPLY_OFFER_EXHAUSTED',
  'DISTRIBUTION_NODE_ACTIVATED',
  'DISTRIBUTION_NODE_OFFLINE',
  'DISTRIBUTION_NODE_SATURATED',
  'DEMAND_REGISTERED',
  'CYCLE_COMPLETED',
]);

class EconomicSignal {
  constructor({ type, zonaId, rubroId, actorId, magnitude = 1, occurredAt }) {
    if (!SIGNAL_TYPES.includes(type)) throw new Error(`EconomicSignal tipo inválido: ${type}`);
    if (!zonaId)  throw new Error('zonaId requerido');
    if (!rubroId) throw new Error('rubroId requerido');
    this._type       = type;
    this._zonaId     = zonaId;
    this._rubroId    = rubroId;
    this._actorId    = actorId || null;
    this._magnitude  = Math.max(0, Number(magnitude) || 1);
    this._occurredAt = occurredAt || new Date().toISOString();
  }
  get type()       { return this._type; }
  get zonaId()     { return this._zonaId; }
  get rubroId()    { return this._rubroId; }
  get actorId()    { return this._actorId; }
  get magnitude()  { return this._magnitude; }
  get occurredAt() { return this._occurredAt; }
  toJSON() {
    return { type: this._type, zonaId: this._zonaId, rubroId: this._rubroId,
             actorId: this._actorId, magnitude: this._magnitude, occurredAt: this._occurredAt };
  }
  static get VALID_TYPES() { return SIGNAL_TYPES; }
}
module.exports = { EconomicSignal };
