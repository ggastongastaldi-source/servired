'use strict';
/**
 * LogisticCapacity — throughput logístico del nodo.
 * Distinto de ProductionCapacity: mide flujo de distribución, no producción.
 */
class LogisticCapacity {
  constructor({ maxDailyOrders = 1, currentLoad = 0, storageM3 = 0 }) {
    if (maxDailyOrders < 1) throw new Error('maxDailyOrders debe ser >= 1');
    if (currentLoad < 0)    throw new Error('currentLoad debe ser >= 0');
    if (currentLoad > maxDailyOrders) throw new Error('currentLoad no puede superar maxDailyOrders');
    this._maxDailyOrders = maxDailyOrders;
    this._currentLoad    = currentLoad;
    this._storageM3      = Math.max(0, Number(storageM3) || 0);
  }
  get maxDailyOrders() { return this._maxDailyOrders; }
  get currentLoad()    { return this._currentLoad; }
  get storageM3()      { return this._storageM3; }
  get availableSlots() { return this._maxDailyOrders - this._currentLoad; }
  get loadRate() {
    return parseFloat((this._currentLoad / this._maxDailyOrders).toFixed(4));
  }
  isSaturated() { return this._currentLoad >= this._maxDailyOrders; }
  addLoad(units = 1) {
    if (this._currentLoad + units > this._maxDailyOrders)
      throw new Error(`Capacidad logística saturada: disponible ${this.availableSlots}, solicitado ${units}`);
    return new LogisticCapacity({ maxDailyOrders: this._maxDailyOrders, currentLoad: this._currentLoad + units, storageM3: this._storageM3 });
  }
  releaseLoad(units = 1) {
    return new LogisticCapacity({ maxDailyOrders: this._maxDailyOrders, currentLoad: Math.max(0, this._currentLoad - units), storageM3: this._storageM3 });
  }
  toJSON() { return { maxDailyOrders: this._maxDailyOrders, currentLoad: this._currentLoad, storageM3: this._storageM3 }; }
}
module.exports = { LogisticCapacity };
