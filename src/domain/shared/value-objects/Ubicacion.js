'use strict';

class Ubicacion {
  constructor({ lat, lng, direccion = null }) {
    if (typeof lat !== 'number' || lat < -90  || lat > 90)
      throw new Error(`Ubicacion: lat inválida (${lat})`);
    if (typeof lng !== 'number' || lng < -180 || lng > 180)
      throw new Error(`Ubicacion: lng inválida (${lng})`);
    this._lat      = lat;
    this._lng      = lng;
    this._direccion = direccion;
    Object.freeze(this);
  }

  get lat()       { return this._lat;      }
  get lng()       { return this._lng;      }
  get direccion() { return this._direccion; }

  toGeoJSON() {
    return { type: 'Point', coordinates: [this._lng, this._lat] };
  }

  equals(otro) {
    return otro instanceof Ubicacion &&
      this._lat === otro._lat &&
      this._lng === otro._lng;
  }

  toString() { return `(${this._lat}, ${this._lng})`; }
}

module.exports = { Ubicacion };
