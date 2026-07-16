'use strict';
/**
 * ZoneHealth — estado de salud económica de una zona territorial.
 * Emerge de la relación entre oferta disponible, demanda activa
 * y capacidad logística de los nodos de distribución.
 *
 * No es un dato operativo. Es inteligencia colectiva derivada.
 */
const STATES = Object.freeze(['CRITICAL','DEFICIT','BALANCED','SURPLUS','SATURATED']);

class ZoneHealth {
  constructor(value) {
    if (!STATES.includes(value)) throw new Error(`ZoneHealth inválido: ${value}`);
    this._value = value;
  }
  get value() { return this._value; }
  get requiresIntervention() { return ['CRITICAL','DEFICIT'].includes(this._value); }
  get isOptimal()            { return this._value === 'BALANCED'; }
  toString() { return this._value; }

  /**
   * Calcula ZoneHealth desde señales agregadas.
   * Algoritmo determinista — misma entrada siempre produce mismo resultado.
   */
  static fromSignals({ activeOffers, activeNodes, pendingDemand, logisticLoad }) {
    if (activeNodes === 0 || activeOffers === 0) return new ZoneHealth('CRITICAL');
    const supplyRatio  = activeOffers / Math.max(1, pendingDemand);
    const logisticRate = logisticLoad  / Math.max(1, activeNodes);
    if (supplyRatio < 0.3)                          return new ZoneHealth('CRITICAL');
    if (supplyRatio < 0.7)                          return new ZoneHealth('DEFICIT');
    if (logisticRate > 0.9)                         return new ZoneHealth('SATURATED');
    if (supplyRatio > 2.0 && logisticRate < 0.3)   return new ZoneHealth('SURPLUS');
    return new ZoneHealth('BALANCED');
  }
}
module.exports = { ZoneHealth };
