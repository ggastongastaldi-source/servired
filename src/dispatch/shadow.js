const { generateCandidates } = require('./intelligence');
const { estimateETA }        = require('./services/ETAProvider');

// ── Versiones dinámicas — nunca hardcodeadas ──────────────────
const DE_VERSION = process.env.DISPATCH_ENGINE_VERSION || '1.0';
const GR_VERSION = process.env.GLOBULO_ROJO_VERSION    || '2.1';

// ── Modelo FÉNIX — evolución del schema existente ────────────
let ShadowComparison;
function getModel() {
  if (!ShadowComparison) {
    const mongoose = require('mongoose');

    // Schema FÉNIX v2 — compatible con datos históricos en shadow_comparisons
    const schema = new mongoose.Schema({
      // ── Identidad ────────────────────────────────────────────
      orderId:   { type: String, required: true, index: true },
      pedidoId:  { type: String, index: true }, // alias legacy

      // ── Veredicto ────────────────────────────────────────────
      winner: {
        type: String,
        enum: ['DE', 'GR', 'TIE', 'INCONCLUSIVE'],
        default: 'INCONCLUSIVE',
      },

      // ── Métricas (unidades explícitas) ───────────────────────
      metrics: {
        etaDelta:       { value: Number, unit: { type: String, default: 'minutes' } },
        scoreDelta:     { value: Number, unit: { type: String, default: 'points'  } },
        distanceDelta:  { value: Number, unit: { type: String, default: 'km'      } },
      },

      // ── Contexto ─────────────────────────────────────────────
      context: {
        zone:      String,
        hour:      { type: Number, min: 0, max: 23 },
        dayOfWeek: { type: Number, min: 0, max: 6  }, // 0=domingo
      },

      // ── Razones del veredicto ────────────────────────────────
      reasons: [String],

      // ── Versiones dinámicas ──────────────────────────────────
      versions: {
        de: { type: String, default: () => DE_VERSION },
        gr: { type: String, default: () => GR_VERSION },
      },

      // ── Campos legacy (conservados para no romper datos viejos)
      gr_workerIds:   [String],
      gr_workerCount: Number,
      de_topWorkerId: String,
      de_topScore:    Number,
      de_topETA:      Number,
      de_candidates:  Number,
      de_strategy:    String,
      de_expanded:    Boolean,
      match:          Boolean,
      matchRate:      Number,
      etaDeltaMinutes: Number, // legacy alias de metrics.etaDelta.value

    }, { timestamps: true }); // createdAt automático

    schema.index({ 'context.zone': 1, createdAt: -1 });
    schema.index({ winner: 1 });

    ShadowComparison = mongoose.models.ShadowComparison ||
      mongoose.model('ShadowComparison', schema, 'shadow_comparisons');
  }
  return ShadowComparison;
}

// ── runShadow — hook principal, NUNCA bloquea GR ─────────────
async function runShadow(pedido, grWorkers) {
  const pedidoId = String(pedido._id);
  const startTs  = Date.now();

  try {
    const Usuario = require('../core/models/Usuario');
    const allWorkers = await Usuario.find({
      rol:        { $in: ['TRABAJADOR', 'WORKER'] },
      disponible: true,
    }).select('_id ubicacion zona especialidades rubro fcmToken nombre').lean();

    const result     = await generateCandidates({ pedido, workers: allWorkers });
    const deCandidates = result.candidates || [];
    const deTop        = deCandidates[0];

    // ── Coincidencia legacy ───────────────────────────────────
    const grIds     = (grWorkers || []).map(w => String(w._id));
    const deIds     = deCandidates.slice(0, 5).map(c => c.workerId);
    const matches   = grIds.filter(id => deIds.includes(id));
    const matchRate = grIds.length > 0 ? matches.length / grIds.length : 0;
    const match     = matches.length > 0;

    // ── ETA delta (minutos) ───────────────────────────────────
    let etaDeltaMin   = null;
    let distDeltaKm   = null;
    let scoreDeltaPts = null;

    if (deTop && grWorkers && grWorkers.length > 0) {
      const grTop      = grWorkers[0];
      const jobLocation = {
        lat: pedido.ubicacion?.coordinates?.[1],
        lng: pedido.ubicacion?.coordinates?.[0],
      };
      const grETA = estimateETA({
        workerLocation: {
          lat: grTop.ubicacion?.coordinates?.[1],
          lng: grTop.ubicacion?.coordinates?.[0],
          zona: grTop.zona,
        },
        jobLocation,
      });

      // ETA delta — MINUTOS (unidad confirmada por auditoría)
      etaDeltaMin = (grETA.etaMinutes || 0) - (deTop.etaMinutes || 0);

      // Distance delta — KM (haversine retorna km)
      const { haversine } = require('../../globuloRojo/haversine');
      const jobLat = pedido.ubicacion?.coordinates?.[1];
      const jobLon = pedido.ubicacion?.coordinates?.[0];
      if (jobLat && jobLon) {
        const grLat  = grTop.ubicacion?.coordinates?.[1];
        const grLon  = grTop.ubicacion?.coordinates?.[0];
        const deLat  = deTop.lat || deTop.ubicacion?.coordinates?.[1];
        const deLon  = deTop.lng || deTop.ubicacion?.coordinates?.[0];
        const grDist = (grLat && grLon) ? haversine(jobLat, jobLon, grLat, grLon) : null;
        const deDist = (deLat && deLon) ? haversine(jobLat, jobLon, deLat, deLon) : null;
        if (grDist !== null && deDist !== null) {
          distDeltaKm = grDist - deDist; // positivo = DE más cercano
        }
      }

      // Score delta — puntos Briones vs score DE
      const grScore = grTop.scoreBriones || 0;
      const deScore = deTop.score        || 0;
      scoreDeltaPts = deScore - grScore; // positivo = DE mejor score
    }

    // ── Veredicto ────────────────────────────────────────────
    const reasons = [];
    let winner    = 'INCONCLUSIVE';

    if (etaDeltaMin !== null || distDeltaKm !== null || scoreDeltaPts !== null) {
      let dePoints = 0;
      let grPoints = 0;

      if (etaDeltaMin !== null) {
        if (etaDeltaMin > 2)       { dePoints++; reasons.push('DE_FASTER_ETA_' + Math.round(etaDeltaMin) + 'min'); }
        else if (etaDeltaMin < -2) { grPoints++; reasons.push('GR_FASTER_ETA_' + Math.round(-etaDeltaMin) + 'min'); }
        else                       { reasons.push('ETA_TIE'); }
      }
      if (distDeltaKm !== null) {
        if (distDeltaKm > 0.5)       { dePoints++; reasons.push('DE_CLOSER_' + distDeltaKm.toFixed(1) + 'km'); }
        else if (distDeltaKm < -0.5) { grPoints++; reasons.push('GR_CLOSER_' + (-distDeltaKm).toFixed(1) + 'km'); }
        else                         { reasons.push('DISTANCE_TIE'); }
      }
      if (scoreDeltaPts !== null) {
        if (scoreDeltaPts > 5)       { dePoints++; reasons.push('DE_BETTER_SCORE_+' + Math.round(scoreDeltaPts)); }
        else if (scoreDeltaPts < -5) { grPoints++; reasons.push('GR_BETTER_SCORE_+' + Math.round(-scoreDeltaPts)); }
        else                         { reasons.push('SCORE_TIE'); }
      }

      if      (dePoints > grPoints) winner = 'DE';
      else if (grPoints > dePoints) winner = 'GR';
      else if (dePoints === grPoints && dePoints > 0) winner = 'TIE';
    }

    // ── Contexto temporal ────────────────────────────────────
    const now = new Date();
    const context = {
      zone:      pedido.zona || null,
      hour:      now.getHours(),
      dayOfWeek: now.getDay(),
    };

    // ── Persistir — fire and forget, nunca bloquea GR ────────
    const Model = getModel();
    await Model.create({
      orderId:  pedidoId,
      pedidoId,
      winner,
      metrics: {
        etaDelta:      { value: etaDeltaMin,   unit: 'minutes' },
        scoreDelta:    { value: scoreDeltaPts,  unit: 'points'  },
        distanceDelta: { value: distDeltaKm,    unit: 'km'      },
      },
      context,
      reasons,
      versions: { de: DE_VERSION, gr: GR_VERSION },
      // legacy
      gr_workerIds:    grIds,
      gr_workerCount:  grIds.length,
      de_topWorkerId:  deTop?.workerId || null,
      de_topScore:     deTop?.score    || 0,
      de_topETA:       deTop?.etaMinutes || null,
      de_candidates:   deCandidates.length,
      de_strategy:     result.event || 'DISPATCH_CANDIDATES_GENERATED',
      de_expanded:     result.expanded || false,
      match,
      matchRate:       Math.round(matchRate * 100) / 100,
      etaDeltaMinutes: etaDeltaMin, // alias legacy
    });

    console.log('[Shadow] ✅ runShadow OK', {
      pedidoId,
      winner,
      grCount:   grIds.length,
      deCount:   deCandidates.length,
      etaDelta:  etaDeltaMin !== null ? etaDeltaMin.toFixed(1) + 'min' : 'n/a',
      distDelta: distDeltaKm !== null ? distDeltaKm.toFixed(2) + 'km'  : 'n/a',
      reasons,
      ms: Date.now() - startTs,
    });

  } catch(err) {
    // NUNCA bloquear flujo principal
    console.error('[Shadow] runShadow ERROR (non-blocking)', {
      pedidoId,
      err: err.message,
    });
  }
}

module.exports = { runShadow };
