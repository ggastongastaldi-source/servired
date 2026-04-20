const { CATALOGO } = require("../../../public/catalogo.js");

// Convertir catalogo a mapa para busqueda rapida
const RUBROS = {};
CATALOGO.forEach(r => {
  RUBROS[r.id] = { precio: r.precio, unidad: r.unidad, label: r.label, minHoras: r.minHoras || null };
});

// Multiplicadores por zona - toda la Argentina
const ZONAS = {
  CABA:          1.20,
  GBA:           1.10,
  ROSARIO:       1.05,
  CORDOBA:       1.05,
  MENDOZA:       1.05,
  MAR_DEL_PLATA: 1.05,
  default:       1.00,
};

const COMPLEJIDAD = { baja: 1.0, media: 1.4, alta: 1.8 };

function calcular(tipoServicio, zona, complejidad, horas) {
  const rubro = RUBROS[tipoServicio];
  if (!rubro) return { ok: false, error: "Rubro no encontrado: " + tipoServicio };
  const zonaKey   = (zona || "").toUpperCase().replace(/ /g,"_");
  const zonaMulti = ZONAS[zonaKey] || ZONAS.default;
  const compMulti = COMPLEJIDAD[complejidad] || COMPLEJIDAD.baja;
  let precioBase  = rubro.precio;
  if (rubro.unidad === "hora") {
    const horasReales = Math.max(horas || rubro.minHoras || 4, rubro.minHoras || 1);
    precioBase = rubro.precio * horasReales;
  }
  const precioMercado = Math.round(precioBase * zonaMulti * compMulti);
  const precioCliente = Math.round(precioMercado * 1.20);
  const pagoWorker    = Math.round(precioMercado * 0.80);
  return { ok:true, tipoServicio, label:rubro.label, unidad:rubro.unidad,
           precioMercado, precioCliente, pagoWorker, comision: precioCliente - pagoWorker,
           zona: zonaKey, complejidad: complejidad || "baja" };
}

function listarRubros() {
  return CATALOGO.map(r => ({ id: r.id, label: r.label, icon: r.icon, precioBase: r.precio, unidad: r.unidad }));
}

module.exports = { calcular, listarRubros, RUBROS, CATALOGO };
