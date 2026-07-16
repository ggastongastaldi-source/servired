'use strict';
/**
 * CommercialTerms — condiciones comerciales de una oferta de suministro.
 */
class CommercialTerms {
  constructor({ priceARS, currency = 'ARS', minOrderUnits = 1, deliveryDays = 1, acceptsCredit = false }) {
    if (typeof priceARS !== 'number' || priceARS < 0)
      throw new Error('priceARS debe ser número >= 0');
    if (minOrderUnits < 1)
      throw new Error('minOrderUnits debe ser >= 1');
    this._priceARS      = priceARS;
    this._currency      = currency;
    this._minOrderUnits = minOrderUnits;
    this._deliveryDays  = deliveryDays;
    this._acceptsCredit = acceptsCredit;
  }
  get priceARS()      { return this._priceARS; }
  get currency()      { return this._currency; }
  get minOrderUnits() { return this._minOrderUnits; }
  get deliveryDays()  { return this._deliveryDays; }
  get acceptsCredit() { return this._acceptsCredit; }
  toJSON() {
    return { priceARS: this._priceARS, currency: this._currency,
             minOrderUnits: this._minOrderUnits, deliveryDays: this._deliveryDays,
             acceptsCredit: this._acceptsCredit };
  }
}
module.exports = { CommercialTerms };
