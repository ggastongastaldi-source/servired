/**
 * ALADÍN — Motor de Presupuesto Inteligente
 * Calibrado con Big Mac Index para resistir inflación
 *
 * Regla constitucional:
 * El catálogo contiene hechos.
 * SINAPSIS contiene relaciones.
 * ALADÍN contiene inferencias.
 * G.I.A. traduce.
 */
const CatalogoItem = require('../models/CatalogoItem');

const BIG_MAC_ARS_ACTUAL = parseFloat(process.env.BIG_MAC_ARS || '8700');

/**
 * Actualizar precios de una lista de ítems usando ratio Big Mac
 * Si el Big Mac subió, los precios se actualizan proporcionalmente
 */
function actualizarPorBigMac(item, bigMacActual) {
  if (!item.bigMacRef || item.bigMacRef === 0) return item;
  const ratio = bigMacActual / item.bigMacRef;
  return {
    ...item,
    precioMaterialActualizado: Math.round(item.precioMaterial * ratio),
    precioManoObraActualizado: Math.round(item.precioManoObra * ratio),
    precioTotalActualizado: Math.round(item.precioTotal * ratio),
    ratioInflacion: parseFloat(ratio.toFixed(3)),
    bigMacActual,
    bigMacOrigen: item.bigMacRef,
  };
}

/**
 * Presupuestar un trabajo de construcción en seco
 * @param {Object} params
 * @param {string} params.categoria - 'tabique' | 'cielorraso' | 'revestimiento'
 * @param {string} [params.subcategoria]
 * @param {number} params.metros - m² a trabajar
 * @param {boolean} [params.incluirManoObra=true]
 * @param {number} [params.bigMacActual] - override del Big Mac actual
 */
async function presupuestar({ categoria, subcategoria, metros, incluirManoObra = true, bigMacActual }) {
  const bmActual = bigMacActual || BIG_MAC_ARS_ACTUAL;

  const query = { categoria, activo: true };
  if (subcategoria) query.subcategoria = subcategoria;

  const items = await CatalogoItem.find(query).lean();
  if (!items.length) return { error: 'No se encontraron ítems para esa categoría', categoria, subcategoria };

  const actualizados = items.map(i => actualizarPorBigMac(i, bmActual));

  const resultados = actualizados.map(item => {
    const precioPorM2 = incluirManoObra
      ? item.precioTotalActualizado
      : item.precioMaterialActualizado;

    return {
      productId: item.productId,
      nombre: item.nombre,
      subcategoria: item.subcategoria,
      unidad: item.unidad,
      precioPorM2,
      precioMaterial: item.precioMaterialActualizado,
      precioManoObra: item.precioManoObraActualizado,
      totalPresupuesto: Math.round(precioPorM2 * metros),
      metros,
      ratioInflacion: item.ratioInflacion,
      fuenteFecha: item.fuenteFecha,
    };
  });

  // Ordenar de menor a mayor costo total
  resultados.sort((a, b) => a.totalPresupuesto - b.totalPresupuesto);

  return {
    categoria,
    subcategoria: subcategoria || 'todas',
    metros,
    incluirManoObra,
    bigMacActual: bmActual,
    opciones: resultados,
    rangoMin: resultados[0].totalPresupuesto,
    rangoMax: resultados[resultados.length - 1].totalPresupuesto,
    opcionRecomendada: resultados[0], // la más económica
  };
}

/**
 * Presupuesto completo de una habitación o espacio
 * @param {Array} trabajos - [{ categoria, subcategoria, metros }, ...]
 */
async function presupuestarEspacio(trabajos, bigMacActual) {
  const resultados = await Promise.all(
    trabajos.map(t => presupuestar({ ...t, bigMacActual }))
  );

  const totalMin = resultados.reduce((acc, r) => acc + (r.rangoMin || 0), 0);
  const totalMax = resultados.reduce((acc, r) => acc + (r.rangoMax || 0), 0);

  return {
    trabajos: resultados,
    totalMin,
    totalMax,
    bigMacActual: bigMacActual || BIG_MAC_ARS_ACTUAL,
  };
}

module.exports = { presupuestar, presupuestarEspacio, actualizarPorBigMac, BIG_MAC_ARS_ACTUAL };
