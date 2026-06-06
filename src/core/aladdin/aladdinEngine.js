'use strict';
const { ZONAS, COMPLEJIDAD, MARGEN_PLATAFORMA, PORCENTAJE_WORKER } = require('./aladdinConfig');
const { CATALOGO } = require('../../../public/catalogo.js');
const RUBROS = {};
CATALOGO.forEach(r => {
  RUBROS[r.id] = { precio: r.precio, unidad: r.unidad, label: r.label, minHoras: r.minHoras || null };
});
function calcular(tipoServicio, zona, complejidad, horas) {
  const rubro = RUBROS[tipoServicio];
  if (!rubro) return { ok: false, error: 'Rubro no encontrado: ' + tipoServicio };
  const zonaKey   = (zona || '').toUpperCase().replace(/ /g, '_');
  const zonaMulti = ZONAS[zonaKey] || ZONAS.default;
  const compMulti = COMPLEJIDAD[complejidad] || COMPLEJIDAD.baja;
  let precioBase = rubro.precio;
  if (rubro.unidad === 'hora') {
    const horasReales = Math.max(horas || rubro.minHoras || 4, rubro.minHoras || 1);
    precioBase = rubro.precio * horasReales;
  }
  const precioMercado = Math.round(precioBase * zonaMulti * compMulti);
  const precioCliente = Math.round(precioMercado * MARGEN_PLATAFORMA);
  const pagoWorker    = Math.round(precioMercado * PORCENTAJE_WORKER);
  return {
    ok: true, tipoServicio, label: rubro.label, unidad: rubro.unidad,
    precioMercado, precioCliente, pagoWorker,
    comision: precioCliente - pagoWorker,
    zona: zonaKey, complejidad: complejidad || 'baja',
  };
}
function listarRubros() {
  return CATALOGO.map(r => ({ id: r.id, label: r.label, icon: r.icon, precioBase: r.precio, unidad: r.unidad }));
}
module.exports = { calcular, listarRubros, RUBROS, CATALOGO };
