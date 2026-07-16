'use strict';
/**
 * ProductionCapacity — cuánto puede producir/proveer un actor por período.
 * Inmutable. Reemplazado completo en cada actualización.
 */
class ProductionCapacity {
  constructor({ totalUnits, availableUnits, unitLabel = 'unidad', periodDays = 30 }) {
    if (typeof totalUnits !== 'number' || totalUnits < 0)
      throw new Error('totalUnits debe ser número >= 0');
    if (typeof availableUnits !== 'number' || availableUnits < 0)
      throw new Error('availableUnits debe ser número >= 0');
    if (availableUnits > totalUnits)
      throw new Error('availableUnits no puede superar totalUnits');
    this._totalUnits     = totalUnits;
    this._availableUnits = availableUnits;
    this._unitLabel      = unitLabel;
    this._periodDays     = periodDays;
  }
  get totalUnits()     { return this._totalUnits; }
  get availableUnits() { return this._availableUnits; }
  get unitLabel()      { return this._unitLabel; }
  get periodDays()     { return this._periodDays; }
  get utilizationRate() {
    if (this._totalUnits === 0) return 0;
    return parseFloat(((this._totalUnits - this._availableUnits) / this._totalUnits).toFixed(4));
  }
  isExhausted() { return this._availableUnits === 0; }
  reserve(units) {
    if (units > this._availableUnits)
      throw new Error(`Capacidad insuficiente: disponible ${this._availableUnits}, solicitado ${units}`);
    return new ProductionCapacity({
      totalUnits:     this._totalUnits,
      availableUnits: this._availableUnits - units,
      unitLabel:      this._unitLabel,
      periodDays:     this._periodDays,
    });
  }
  toJSON() {
    return { totalUnits: this._totalUnits, availableUnits: this._availableUnits,
             unitLabel: this._unitLabel, periodDays: this._periodDays };
  }
  static unlimited() {
    return new ProductionCapacity({ totalUnits: 999999, availableUnits: 999999, unitLabel: 'unidad', periodDays: 30 });
  }
}
module.exports = { ProductionCapacity };
