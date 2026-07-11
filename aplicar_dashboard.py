path = "controllers/merchantController.js"
with open(path, "r", encoding="utf-8") as f:
    contenido = f.read()

# --- Cambio 1: agregar los requires necesarios ---
viejo1 = """const BusinessProfile = require('../models/BusinessProfile');
const CatalogItem = require('../models/CatalogItem');
const { projectMerchantState } = require('../services/merchantProjection');
const { emitEvent } = require('../nexus/events/emitEvent');"""
nuevo1 = """const BusinessProfile = require('../models/BusinessProfile');
const CatalogItem = require('../models/CatalogItem');
const MerchantProjection = require('../models/MerchantProjection');
const { projectMerchantState } = require('../services/merchantProjection');
const { reconstruirProjection } = require('../services/merchantProjectionReactor');
const { emitEvent } = require('../nexus/events/emitEvent');"""
n1 = contenido.count(viejo1)
assert n1 == 1, f"Cambio 1: se esperaba 1 coincidencia, se encontraron {n1}. No se modifica nada."
contenido = contenido.replace(viejo1, nuevo1, 1)

# --- Cambio 2: implementar getDashboard ---
viejo2 = """exports.getDashboard = async (req, res) => {
  res.status(501).json({ error: 'getDashboard no implementado aun (ver Merchant Projection Layer)' });
};"""
nuevo2 = """exports.getDashboard = async (req, res) => {
  try {
    let proj = await MerchantProjection.findOne({ usuarioId: req.userId }).lean();

    if (!proj) {
      // La projection puede no existir todavia si MERCHANT_PROFILE_CREATED
      // no llego a procesarse (emision fire-and-forget, async) o si el
      // perfil es anterior a la integracion de eventos. Reconstruccion
      // sincrona bajo demanda, acotada a este usuario (mismo mecanismo
      // que /admin/reconstruct, sin barrer todos los comercios).
      const profile = await BusinessProfile.findOne({ usuarioId: req.userId }).lean();
      if (!profile) return res.status(404).json({ error: 'Perfil no encontrado' });

      await reconstruirProjection(profile._id, req.userId, null);
      proj = await MerchantProjection.findOne({ usuarioId: req.userId }).lean();
      if (!proj) return res.status(500).json({ error: 'No se pudo construir el dashboard' });
    }

    // Adaptador: nombres del modelo (fuente de verdad del Reactor) ->
    // nombres que espera merchant-app.js (contrato de frontend, no tocar
    // sin revisar renderDashboard() en public/js/merchant-app.js).
    res.json({
      merchantId:      proj.merchantId,
      nombreComercial: proj.nombreComercial,
      estado:          proj.estado,
      logo:            proj.logo,
      actividad: {
        vistasHoy:          proj.dashboard?.vistasHoy || 0,
        solicitudesHoy:     proj.dashboard?.solicitudesHoy || 0,
        pedidosConcretados: proj.dashboard?.pedidosConcretados || 0,
        calificacion:       proj.dashboard?.calificacionPromedio || 0,
      },
      ingresos: {
        estimadoMes: proj.dashboard?.ingresosEstimadoMes || 0,
      },
      campanias: {
        activas: proj.campanias?.activas || 0,
      },
      tendencia: {
        vistasUltimos7dias: proj.analytics?.vistasUltimos7diasSerie || [],
      },
    });
  } catch (e) {
    console.error('[merchant] getDashboard:', e);
    res.status(500).json({ error: 'Error al obtener dashboard' });
  }
};"""
n2 = contenido.count(viejo2)
assert n2 == 1, f"Cambio 2: se esperaba 1 coincidencia, se encontraron {n2}. No se modifica nada."
contenido = contenido.replace(viejo2, nuevo2, 1)

with open(path, "w", encoding="utf-8") as f:
    f.write(contenido)

print("OK: 2 cambios aplicados en", path)
