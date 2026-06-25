'use strict';

/**
 * ROLLING PRICE BASELINE
 * Projection incremental: mantiene mediana móvil de precios
 * por zoneId + rubro en ventana de N eventos recientes.
 *
 * Opera en memoria. Sin Mongo. Sin bloqueo.
 * Se reconstruye al reiniciar (acceptable — es una projection).
 */

const WINDOW_SIZE = 50; // últimos N precios por bucket

// Map: `${zoneId}::${rubro}` → number[]
const _windows = new Map();

function _key(zoneId, rubro) {
  return `${zoneId || 'unknown'}::${rubro || 'unknown'}`;
}

function ingest(zoneId, rubro, price) {
  if (typeof price !== 'number' || isNaN(price) || price <= 0) return;
  const k = _key(zoneId, rubro);
  if (!_windows.has(k)) _windows.set(k, []);
  const w = _windows.get(k);
  w.push(price);
  if (w.length > WINDOW_SIZE) w.shift();
}

function getBaseline(zoneId, rubro) {
  const k = _key(zoneId, rubro);
  const w = _windows.get(k);
  if (!w || w.length < 3) return null; // insuficiente datos
  const sorted = [...w].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function getWindowSize(zoneId, rubro) {
  const w = _windows.get(_key(zoneId, rubro));
  return w ? w.length : 0;
}

module.exports = { ingest, getBaseline, getWindowSize };
