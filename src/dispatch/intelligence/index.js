// dispatch-intelligence microservice
// Responsabilidades: Geo, ETA, Ranking, Mobility, Expansion, Acceptance Prediction
// NO modifica estados. NO ejecuta side effects. NO escrituras transaccionales.
// Solo produce eventos y devuelve datos.

const { rankWorkers }         = require('../services/ScoringEngine');
const { expandCandidates }    = require('../services/DispatchExpansion');
const { estimateETA }         = require('../services/ETAProvider');
const WorkerMobilityProfile   = require('../../../src/models/WorkerMobilityProfile');

// Generar candidatos rankeados para un pedido
// Evento producido: DISPATCH_CANDIDATES_GENERATED
async function generateCandidates({ pedido, workers }) {
  const jobLocation = {
    lat: pedido.ubicacion?.coordinates?.[1],
    lng: pedido.ubicacion?.coordinates?.[0],
  };
  const jobZona     = pedido.zona     || 'default';
  const jobPrice    = pedido.precio   || pedido.total_estimado || 0;
  const category    = pedido.tipoServicio || 'default';
  const hour        = new Date().getHours();

  // 1. Expansion progresiva por rings
  const expanded = expandCandidates(workers, jobLocation, category);

  if (expanded.length === 0) {
    console.log('[Intelligence] generateCandidates — no candidates after expansion', {
      pedidoId: pedido._id, category, jobZona
    });
    return {
      event:      'DISPATCH_CANDIDATES_GENERATED',
      pedidoId:   pedido._id.toString(),
      candidates: [],
      expanded:   false,
    };
  }

  // 2. Cargar perfiles de movilidad
  const workerIds = expanded.map(w => w._id);
  const profiles  = await WorkerMobilityProfile.find({ workerId: { $in: workerIds } }).lean();

  // 3. Ranking con ScoringEngine v2
  const ranked = rankWorkers({
    workers:         expanded,
    workerProfiles:  profiles,
    jobLocation,
    jobZona,
    jobPrice,
    hour,
  });

  console.log('[Intelligence] generateCandidates OK', {
    pedidoId: pedido._id.toString(),
    total:    ranked.length,
    topScore: ranked[0]?.score,
    topETA:   ranked[0]?.etaMinutes,
  });

  return {
    event:      'DISPATCH_CANDIDATES_GENERATED',
    pedidoId:   pedido._id.toString(),
    candidates: ranked,
    expanded:   expanded.some(w => w._ring > 1),
  };
}

// Actualizar perfil de movilidad del worker (upsert)
// Llamar despues de OFFER_ACCEPTED, OFFER_REJECTED, JOB_COMPLETED, JOB_CANCELLED
async function updateWorkerMobilityProfile(workerId, event, { distanceKm, zona } = {}) {
  try {
    const wid = workerId.toString();
    const profile = await WorkerMobilityProfile.findOne({ workerId: wid }).lean() || {
      workerId: wid, acceptanceRate: 0.5, avgTravelKm: 0, maxAcceptedKm: 0,
      preferredZones: [], nightShiftScore: 0.5, completedJobsCount: 0,
    };

    const hour = new Date().getHours();
    const isNight = hour >= 22 || hour <= 6;

    if (event === 'OFFER_ACCEPTED') {
      const n = profile.completedJobsCount + 1;
      profile.acceptanceRate   = ((profile.acceptanceRate * (n-1)) + 1) / n;
      profile.completedJobsCount = n;
      if (distanceKm) {
        profile.avgTravelKm   = ((profile.avgTravelKm * (n-1)) + distanceKm) / n;
        profile.maxAcceptedKm = Math.max(profile.maxAcceptedKm, distanceKm);
      }
      if (zona && !profile.preferredZones.includes(zona)) {
        profile.preferredZones = [...profile.preferredZones.slice(-9), zona];
      }
      if (isNight) {
        profile.nightShiftScore = Math.min(1, profile.nightShiftScore + 0.05);
      }
    }

    if (event === 'OFFER_REJECTED') {
      const n = profile.completedJobsCount + 1;
      profile.acceptanceRate = ((profile.acceptanceRate * (n-1)) + 0) / n;
    }

    if (event === 'JOB_COMPLETED') {
      profile.completedJobsCount += 1;
    }

    profile.updatedAt = new Date();

    await WorkerMobilityProfile.findOneAndUpdate(
      { workerId: wid },
      { $set: profile },
      { upsert: true }
    );

    console.log('[Intelligence] updateWorkerMobilityProfile OK', { workerId: wid, event });
  } catch(err) {
    console.error('[Intelligence] updateWorkerMobilityProfile ERROR', { workerId, event, err: err.message });
  }
}

module.exports = { generateCandidates, updateWorkerMobilityProfile };
