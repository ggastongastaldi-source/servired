const { generateCandidates } = require('./intelligence');
const { estimateETA }        = require('./services/ETAProvider');

// Coleccion SINAPSIS para evidencia de shadow
let ShadowComparison;
function getModel() {
  if (!ShadowComparison) {
    const mongoose = require('mongoose');
    const schema = new mongoose.Schema({
      pedidoId:          { type: String, required: true, index: true },
      ts:                { type: Date, default: Date.now },
      // Globulo Rojo
      gr_workerIds:      [String],
      gr_workerCount:    Number,
      // DispatchEngine
      de_topWorkerId:    String,
      de_topScore:       Number,
      de_topETA:         Number,
      de_candidates:     Number,
      de_strategy:       String,
      de_expanded:       Boolean,
      // Coincidencia
      match:             Boolean,
      matchRate:         Number,
      // Metricas
      etaDeltaMinutes:   Number,
    }, { timestamps: false });
    schema.index({ ts: -1 });
    ShadowComparison = mongoose.models.ShadowComparison ||
      mongoose.model('ShadowComparison', schema, 'shadow_comparisons');
  }
  return ShadowComparison;
}

// Interceptar despacho del Globulo Rojo y correr DispatchEngine en shadow
// grWorkers: array de workers seleccionados por GR
// pedido: documento Pedido
async function runShadow(pedido, grWorkers) {
  const pedidoId = pedido._id.toString();
  const startTs  = Date.now();

  try {
    // 1. Obtener candidatos del DispatchEngine
    const Usuario = require('../old_structure/models/Usuario');
    const allWorkers = await Usuario.find({
      rol:       { $in: ['TRABAJADOR', 'WORKER'] },
      disponible: true,
    }).select('_id ubicacion zona especialidades rubro fcmToken nombre').lean();

    const result = await generateCandidates({ pedido, workers: allWorkers });
    const deCandidates = result.candidates || [];
    const deTop = deCandidates[0];

    // 2. Calcular coincidencia
    const grIds = (grWorkers || []).map(w => w._id.toString());
    const deIds = deCandidates.slice(0, 5).map(c => c.workerId);
    const matches = grIds.filter(id => deIds.includes(id));
    const matchRate = grIds.length > 0 ? matches.length / grIds.length : 0;
    const match = matches.length > 0;

    // 3. Delta de ETA — comparar ETA del top GR vs top DE
    let etaDeltaMinutes = null;
    if (deTop && grWorkers && grWorkers.length > 0) {
      const grTopWorker = grWorkers[0];
      const jobLocation = {
        lat: pedido.ubicacion?.coordinates?.[1],
        lng: pedido.ubicacion?.coordinates?.[0],
      };
      const grETA = estimateETA({
        workerLocation: {
          lat: grTopWorker.ubicacion?.coordinates?.[1],
          lng: grTopWorker.ubicacion?.coordinates?.[0],
          zona: grTopWorker.zona,
        },
        jobLocation,
      });
      etaDeltaMinutes = grETA.etaMinutes - (deTop.etaMinutes || 0);
    }

    // 4. Persistir evidencia en SINAPSIS
    const Model = getModel();
    await Model.create({
      pedidoId,
      gr_workerIds:   grIds,
      gr_workerCount: grIds.length,
      de_topWorkerId: deTop?.workerId || null,
      de_topScore:    deTop?.score    || 0,
      de_topETA:      deTop?.etaMinutes || null,
      de_candidates:  deCandidates.length,
      de_strategy:    result.event || 'DISPATCH_CANDIDATES_GENERATED',
      de_expanded:    result.expanded || false,
      match,
      matchRate:      Math.round(matchRate * 100) / 100,
      etaDeltaMinutes,
    });

    console.log('[Shadow] runShadow OK', {
      pedidoId,
      grCount:    grIds.length,
      deCount:    deCandidates.length,
      match,
      matchRate:  Math.round(matchRate * 100) + '%',
      etaDelta:   etaDeltaMinutes !== null ? etaDeltaMinutes + 'min' : 'n/a',
      deTopScore: deTop?.score,
      ms:         Date.now() - startTs,
    });

  } catch(err) {
    // NUNCA bloquear el flujo principal
    console.error('[Shadow] runShadow ERROR (non-blocking)', { pedidoId, err: err.message });
  }
}

module.exports = { runShadow };
