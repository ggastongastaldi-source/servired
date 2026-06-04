const { estimateETA, etaScore, haversine } = require('./ETAProvider');
const { calculateProfitability } = require('./JobEconomicsEngine');

// Pesos del modelo v2
const WEIGHTS = {
  eta:             0.25,
  distance:        0.10,
  acceptanceHistory: 0.20,
  territorialAffinity: 0.15,
  timeAffinity:    0.10,
  profitability:   0.20,
};

// Verificar que los pesos sumen 1
const totalWeight = Object.values(WEIGHTS).reduce((a,b) => a+b, 0);
if (Math.abs(totalWeight - 1.0) > 0.001) {
  console.error('[ScoringEngine] WEIGHTS no suman 1.0:', totalWeight);
}

// Score de distancia: 0-1, < 2km → 1.0, > 50km → 0.0
function distanceScore(distanceKm) {
  if (distanceKm <= 2)  return 1.0;
  if (distanceKm >= 50) return 0.0;
  return Math.round((1 - (distanceKm - 2) / 48) * 100) / 100;
}

// Score de historial de aceptacion: acceptanceRate ∈ [0,1]
function acceptanceHistoryScore(profile) {
  if (!profile || !profile.completedJobsCount) return 0.5; // neutral si sin historial
  return Math.min(1, Math.max(0, profile.acceptanceRate || 0.5));
}

// Score de afinidad territorial: zonas preferidas del worker
function territorialAffinityScore(profile, jobZona) {
  if (!profile || !profile.preferredZones || !profile.preferredZones.length) return 0.5;
  return profile.preferredZones.includes(jobZona) ? 1.0 : 0.3;
}

// Score de afinidad horaria: night shift
function timeAffinityScore(profile, hour) {
  if (!profile) return 0.5;
  const isNight = hour >= 22 || hour <= 6;
  if (isNight && profile.nightShiftScore > 0.7) return 1.0;
  if (isNight && profile.nightShiftScore < 0.3) return 0.1;
  return 0.7;
}

// Score final: ProbabilityOfSuccessfulAssignment ∈ [0,1]
function scoreWorker({ worker, workerProfile, jobLocation, jobZona, jobPrice, hour }) {
  const workerLocation = {
    lat: worker.ubicacion?.coordinates?.[1],
    lng: worker.ubicacion?.coordinates?.[0],
    zona: worker.zona,
  };

  const { etaMinutes, distanceKm } = estimateETA({ workerLocation, jobLocation, hour });

  const scores = {
    eta:                 etaScore(etaMinutes),
    distance:            distanceScore(distanceKm),
    acceptanceHistory:   acceptanceHistoryScore(workerProfile),
    territorialAffinity: territorialAffinityScore(workerProfile, jobZona),
    timeAffinity:        timeAffinityScore(workerProfile, hour),
    profitability:       calculateProfitability({ distanceKm, etaMinutes, jobPrice }),
  };

  const score = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => {
    return sum + (scores[key] || 0) * weight;
  }, 0);

  return {
    workerId:    worker._id.toString(),
    score:       Math.round(score * 1000) / 1000,
    etaMinutes,
    distanceKm,
    scores,
  };
}

// Rankear lista de workers por score desc
function rankWorkers({ workers, workerProfiles, jobLocation, jobZona, jobPrice, hour }) {
  const h = hour !== undefined ? hour : new Date().getHours();
  const profileMap = {};
  if (workerProfiles) {
    for (const p of workerProfiles) profileMap[p.workerId.toString()] = p;
  }

  return workers
    .map(w => scoreWorker({
      worker:        w,
      workerProfile: profileMap[w._id.toString()],
      jobLocation,
      jobZona,
      jobPrice,
      hour:          h,
    }))
    .sort((a, b) => b.score - a.score);
}

module.exports = { scoreWorker, rankWorkers, WEIGHTS };
