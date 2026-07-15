'use strict';
/**
 * EconomicCapacity — lo que un actor puede ofrecer al ecosistema.
 * Inmutable. Se reemplaza completo en cada actualización.
 */
class EconomicCapacity {
  constructor({ rubroIds = [], zonaIds = [], maxConcurrentJobs = 1, monthlyCapacityARS = 0 }) {
    if (!Array.isArray(rubroIds)) throw new Error('rubroIds debe ser array');
    if (!Array.isArray(zonaIds))  throw new Error('zonaIds debe ser array');
    this._rubroIds            = Object.freeze([...rubroIds]);
    this._zonaIds             = Object.freeze([...zonaIds]);
    this._maxConcurrentJobs   = Math.max(1, Number(maxConcurrentJobs) || 1);
    this._monthlyCapacityARS  = Math.max(0, Number(monthlyCapacityARS) || 0);
  }
  get rubroIds()           { return this._rubroIds; }
  get zonaIds()            { return this._zonaIds; }
  get maxConcurrentJobs()  { return this._maxConcurrentJobs; }
  get monthlyCapacityARS() { return this._monthlyCapacityARS; }
  coversZone(zonaId)  { return this._zonaIds.includes(zonaId); }
  coversRubro(rubroId){ return this._rubroIds.includes(rubroId); }
  toJSON() {
    return {
      rubroIds: this._rubroIds,
      zonaIds:  this._zonaIds,
      maxConcurrentJobs:  this._maxConcurrentJobs,
      monthlyCapacityARS: this._monthlyCapacityARS,
    };
  }
  static empty() {
    return new EconomicCapacity({ rubroIds: [], zonaIds: [], maxConcurrentJobs: 1, monthlyCapacityARS: 0 });
  }
}

module.exports = { EconomicCapacity };
