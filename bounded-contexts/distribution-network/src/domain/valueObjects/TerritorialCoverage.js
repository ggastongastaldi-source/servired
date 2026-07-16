'use strict';
/**
 * TerritorialCoverage — qué zonas y rubros puede atender este nodo.
 * Concepto de dominio: no es un perfil, es capacidad logística verificable.
 */
class TerritorialCoverage {
  constructor({ zonaIds = [], rubroIds = [], radiusKm = 0 }) {
    if (!Array.isArray(zonaIds))  throw new Error('zonaIds debe ser array');
    if (!Array.isArray(rubroIds)) throw new Error('rubroIds debe ser array');
    this._zonaIds  = Object.freeze([...zonaIds]);
    this._rubroIds = Object.freeze([...rubroIds]);
    this._radiusKm = Math.max(0, Number(radiusKm) || 0);
  }
  get zonaIds()  { return this._zonaIds; }
  get rubroIds() { return this._rubroIds; }
  get radiusKm() { return this._radiusKm; }
  coversZone(zonaId)   { return this._zonaIds.includes(zonaId); }
  coversRubro(rubroId) { return this._rubroIds.includes(rubroId); }
  canService(zonaId, rubroId) { return this.coversZone(zonaId) && this.coversRubro(rubroId); }
  toJSON() { return { zonaIds: this._zonaIds, rubroIds: this._rubroIds, radiusKm: this._radiusKm }; }
  static empty() { return new TerritorialCoverage({ zonaIds: [], rubroIds: [], radiusKm: 0 }); }
}
module.exports = { TerritorialCoverage };
