'use strict';
/**
 * CycleValue — valor económico verificable de un ciclo completado.
 * Inmutable. Se calcula al cerrar el ciclo.
 */
class CycleValue {
  constructor({ grossARS, commissionARS, workerARS, currency = 'ARS' }) {
    if (typeof grossARS !== 'number' || grossARS < 0)      throw new Error('grossARS inválido');
    if (typeof commissionARS !== 'number' || commissionARS < 0) throw new Error('commissionARS inválido');
    if (typeof workerARS !== 'number' || workerARS < 0)    throw new Error('workerARS inválido');
    if (Math.abs(grossARS - commissionARS - workerARS) > 0.01)
      throw new Error(`CycleValue inconsistente: ${grossARS} ≠ ${commissionARS} + ${workerARS}`);
    this._grossARS      = grossARS;
    this._commissionARS = commissionARS;
    this._workerARS     = workerARS;
    this._currency      = currency;
  }
  get grossARS()      { return this._grossARS; }
  get commissionARS() { return this._commissionARS; }
  get workerARS()     { return this._workerARS; }
  get currency()      { return this._currency; }
  toJSON() {
    return { grossARS: this._grossARS, commissionARS: this._commissionARS,
             workerARS: this._workerARS, currency: this._currency };
  }
  static zero() { return new CycleValue({ grossARS: 0, commissionARS: 0, workerARS: 0 }); }
}
module.exports = { CycleValue };
