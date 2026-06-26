/**
 * MerchantProjectionReactor v1.0
 * 
 * Escucha eventos del bus SINAPSIS.
 * Actualiza la colección merchant_projections (read model).
 * 
 * Garantías:
 *   - Idempotente: mismo evento procesado dos veces → mismo resultado
 *   - No modifica el Core (Event Store, Dixie, Ledger)
 *   - No ejecuta lógica de negocio — solo proyecta estado
 *   - Fallo aislado: si el reactor falla, el Core sigue funcionando
 */
const BusinessProfile    = require('../models/BusinessProfile');
const CatalogItem        = require('../models/CatalogItem');
const MarketingEvent     = require('../models/MarketingEvent');
const MerchantProjection = require('../models/MerchantProjection');

// ── Eventos que este reactor maneja ────────────────────────────────────────
const EVENTOS_RELEVANTES = new Set([
  'MERCHANT_PROFILE_CREATED',
  'MERCHANT_PROFILE_UPDATED',
  'CATALOG_ITEM_CREATED',
  'CATALOG_ITEM_UPDATED',
  'CATALOG_ITEM_REMOVED',
  'commerce_feed_view',
  'boost_initiated',
  'boost_completed'
]);

// ── Entry point: procesar un evento del bus ────────────────────────────────
async function procesarEvento(evento) {
  if (!evento || !EVENTOS_RELEVANTES.has(evento.eventType)) return;

  const merchantId = evento.payload?.merchantId || evento.properties?.merchantId;
  const usuarioId  = evento.payload?.usuarioId  || evento.properties?.usuarioId;

  if (!merchantId && !usuarioId) return;

  try {
    // Idempotencia atómica: intento reservar el hash antes de procesar.
    // Si otro proceso ya tomó este hash, el upsert falla silenciosamente.
    // Usa findOneAndUpdate condicional — una sola operación, sin race condition.
    if (evento.hash) {
      const perfil = merchantId
        ? await (require('../models/BusinessProfile')).findById(merchantId).lean()
        : await (require('../models/BusinessProfile')).findOne({ usuarioId }).lean();

      if (perfil) {
        // Intentamos marcar el hash ANTES de reconstruir.
        // Si el hash ya existe en este merchantId, el filtro no matchea → no actualiza.
        const resultado = await MerchantProjection.findOneAndUpdate(
          {
            merchantId: perfil._id,
            $or: [
              { ultimoEventoProcesado: { $ne: evento.hash } },
              { ultimoEventoProcesado: null }
            ]
          },
          { $set: { ultimoEventoProcesado: evento.hash } },
          { upsert: false }  // no crear si no existe aún — la creará reconstruirProjection
        );
        // Si resultado es null Y ya existe el documento → hash duplicado → skip
        const yaExiste = await MerchantProjection.findOne({
          merchantId: perfil._id,
          ultimoEventoProcesado: evento.hash
        }).lean();
        // Si ya existe con este hash exacto Y no fue el que acabamos de escribir → skip
        if (!resultado && yaExiste) return;
      }
    }

    await reconstruirProjection(merchantId, usuarioId, evento.hash);
  } catch (e) {
    // Reactor falla en silencio — no propaga al Core
    console.error('[MerchantReactor] error procesando evento:', evento.eventType, e.message);
  }
}

// ── Reconstrucción completa de la projection para un comercio ──────────────
async function reconstruirProjection(merchantId, usuarioId, ultimoHash) {
  // Resolver identidad
  let profile;
  if (merchantId) {
    profile = await BusinessProfile.findById(merchantId).lean();
  } else if (usuarioId) {
    profile = await BusinessProfile.findOne({ usuarioId }).lean();
  }
  if (!profile) return;

  const pid = profile._id;

  // ── Una sola query por ventana temporal (elimina N+1) ──────────────────
  const ahora     = new Date();
  const inicioHoy = new Date(ahora); inicioHoy.setHours(0,0,0,0);
  const inicioMes = new Date(ahora); inicioMes.setDate(1); inicioMes.setHours(0,0,0,0);

  // Query única: traemos el mes completo y filtramos en memoria
  const eventosMes = await MarketingEvent.find({
    'properties.merchantId': String(pid),
    timestamp: { $gte: inicioMes }
  }).lean();

  // Particiones en memoria — O(n) sobre eventosMes, n = eventos del mes
  const eventosHoy = eventosMes.filter(e => new Date(e.timestamp) >= inicioHoy);
  const hace7dias  = new Date(ahora); hace7dias.setDate(ahora.getDate() - 7);
  const eventosSem = eventosMes.filter(e => new Date(e.timestamp) >= hace7dias);

  // Items del catálogo
  const items = await CatalogItem.find({ merchantId: pid }).lean();
  const itemsActivos = items.filter(i => i.estado === 'ACTIVO');

  // ── Cálculos deterministas ─────────────────────────────────────────────
  const vistasHoy      = contarTipo(eventosHoy, 'commerce_feed_view');
  const solicitudesHoy = contarTipo(eventosHoy, 'boost_initiated');
  const vistas7dias    = contarTipo(eventosSem, 'commerce_feed_view');
  const vistas30dias   = contarTipo(eventosMes, 'commerce_feed_view');
  const boostActivos   = contarTipo(eventosSem, 'boost_completed');
  const conversionRate = calcConversion(eventosMes);
  const topProductos   = calcTopProductos(eventosMes, itemsActivos);
  const serie7vistas   = agruparPorDia(eventosSem.filter(e => e.eventType === 'commerce_feed_view'));
  const serie7solicitudes = agruparPorDia(eventosSem.filter(e => e.eventType === 'boost_initiated'));

  // ── Upsert atómico del read model ──────────────────────────────────────
  const proyeccion = {
    merchantId:      pid,
    usuarioId:       profile.usuarioId,
    nombreComercial: profile.nombreComercial,
    estado:          profile.estado,
    verificado:      profile.verificado,
    logo:            profile.logo,
    zonaId:          profile.zonaId,
    rubroId:         profile.rubroId,

    dashboard: {
      vistasHoy,
      vistasUltimos7dias:  vistas7dias,
      vistasUltimos30dias: vistas30dias,
      solicitudesHoy,
      pedidosConcretados:  profile.metricas?.pedidosConcretados || 0,
      calificacionPromedio:profile.metricas?.calificacionPromedio || 0,
      ingresosEstimadoMes: 0,  // conectar con Ledger en P7
      boostActivos
    },

    catalogo: {
      totalItems:  itemsActivos.length,
      enPromocion: itemsActivos.filter(i => i.enPromocion).length,
      sinStock:    itemsActivos.filter(i => i.stock !== null && i.stock === 0).length,
      topProductos
    },

    analytics: {
      conversionRate,
      vistasUltimos7diasSerie:      serie7vistas,
      solicitudesUltimos7diasSerie: serie7solicitudes
    },

    campanias: {
      activas:         boostActivos,
      vistasGeneradas: vistas7dias,
      conversionRate
    },

    ultimoEventoProcesado: ultimoHash || null,
    actualizadaEn: ahora
  };

  await MerchantProjection.findOneAndUpdate(
    { merchantId: pid },
    { $set: proyeccion, $inc: { version: 1 } },
    { upsert: true, new: true }
  );
}

// ── Reconstrucción forzada (para bootstrap / repair) ──────────────────────
async function reconstruirTodos() {
  const profiles = await BusinessProfile.find({}).lean();
  let ok = 0, err = 0;
  for (const p of profiles) {
    try {
      await reconstruirProjection(p._id, p.usuarioId, null);
      ok++;
    } catch (e) {
      err++;
      console.error(`[MerchantReactor] reconstruir ${p._id}:`, e.message);
    }
  }
  console.log(`[MerchantReactor] reconstrucción completa: ${ok} ok, ${err} errores`);
  return { ok, err };
}

// ── Helpers deterministas ──────────────────────────────────────────────────
function contarTipo(eventos, tipo) {
  return eventos.filter(e => e.eventType === tipo).length;
}

function calcConversion(eventos) {
  const vistas = contarTipo(eventos, 'commerce_feed_view');
  const boosts  = contarTipo(eventos, 'boost_completed');
  if (!vistas) return 0;
  return Math.round((boosts / vistas) * 10000) / 100;
}

function calcTopProductos(eventos, items) {
  const conteo = {};
  eventos.forEach(e => {
    const pid = e.properties?.itemId;
    if (pid) conteo[pid] = (conteo[pid] || 0) + 1;
  });
  return items
    .map(i => ({ id: i._id, nombre: i.nombre, vistas: conteo[String(i._id)] || 0, precio: i.precioARS }))
    .sort((a, b) => b.vistas - a.vistas)
    .slice(0, 5);
}

function agruparPorDia(eventos) {
  const mapa = {};
  eventos.forEach(e => {
    const dia = new Date(e.timestamp).toISOString().slice(0, 10);
    mapa[dia] = (mapa[dia] || 0) + 1;
  });
  const resultado = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    resultado.push({ fecha: key, cantidad: mapa[key] || 0 });
  }
  return resultado;
}

module.exports = { procesarEvento, reconstruirProjection, reconstruirTodos };
