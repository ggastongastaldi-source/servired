'use strict';
/**
 * Location — Value Object inmutable.
 * Representa la ubicación geográfica y administrativa de una fábrica.
 */
class Location {
  #provincia;
  #localidad;
  #direccion;
  #coordinates; // [lng, lat] — compatible con MongoDB 2dsphere

  constructor({ provincia, localidad, direccion, coordinates = null }) {
    if (!provincia || !localidad) {
      throw new Error('Location: provincia y localidad son obligatorios');
    }
    if (coordinates !== null) {
      if (!Array.isArray(coordinates) || coordinates.length !== 2 ||
          !coordinates.every(Number.isFinite)) {
        throw new Error('Location: coordinates debe ser [lng, lat] con valores numéricos');
      }
      const [lng, lat] = coordinates;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        throw new Error(`Location: coordenadas fuera de rango [${lng}, ${lat}]`);
      }
    }
    this.#provincia   = String(provincia).trim();
    this.#localidad   = String(localidad).trim();
    this.#direccion   = direccion ? String(direccion).trim() : null;
    this.#coordinates = coordinates ? [...coordinates] : null;
    Object.freeze(this);
  }

  get provincia()   { return this.#provincia; }
  get localidad()   { return this.#localidad; }
  get direccion()   { return this.#direccion; }
  get coordinates() { return this.#coordinates ? [...this.#coordinates] : null; }

  hasCoordinates() { return this.#coordinates !== null; }

  toGeoJSON() {
    if (!this.#coordinates) return null;
    return { type: 'Point', coordinates: [...this.#coordinates] };
  }

  equals(other) {
    return other instanceof Location &&
      other.provincia === this.#provincia &&
      other.localidad === this.#localidad &&
      other.direccion === this.#direccion &&
      JSON.stringify(other.coordinates) === JSON.stringify(this.#coordinates);
  }

  toString() {
    const parts = [this.#localidad, this.#provincia];
    if (this.#direccion) parts.unshift(this.#direccion);
    return parts.join(', ');
  }
}

module.exports = { Location };
