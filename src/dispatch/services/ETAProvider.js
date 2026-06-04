// ETAProvider — independiente de ScoringEngine
// ScoringEngine consume ETAProvider, no al reves

// Corredores rapidos Argentina AMBA
const FAST_CORRIDORS = [
  { name: 'Autopista 25 de Mayo',    speedKmh: 80 },
  { name: 'Autopista Perito Moreno', speedKmh: 80 },
  { name: 'Autopista Del Buen Ayre', speedKmh: 90 },
  { name: 'Autopista Panamericana',  speedKmh: 100 },
  { name: 'Autopista Ricchieri',     speedKmh: 90 },
  { name: 'Ruta 2',                  speedKmh: 110 },
];

// Velocidades base por tipo de zona
const ZONE_SPEEDS = {
  CABA:         25,  // km/h promedio urbano denso
  GBA_NORTE:    35,
  GBA_SUR:      35,
  GBA_OESTE:    35,
  INTERIOR:     60,
  default:      40,
};

// Factores de congestion por hora (0=medianoche, 23=11pm)
const CONGESTION_FACTORS = [
  0.9, 0.9, 0.9, 0.9, 0.9, 0.9,  // 0-5h
  1.0, 1.2, 1.5, 1.4, 1.2, 1.1,  // 6-11h
  1.2, 1.1, 1.0, 1.0, 1.1, 1.3,  // 12-17h
  1.5, 1.4, 1.2, 1.1, 1.0, 0.9,  // 18-23h
];

// Distancia haversine en km
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 +
            Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) *
            Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// Estimar ETA en minutos
// workerLocation: { lat, lng, zona }
// jobLocation:    { lat, lng }
function estimateETA({ workerLocation, jobLocation, hour }) {
  if (!workerLocation || !jobLocation) return { etaMinutes: 999, distanceKm: 999 };

  const distanceKm = haversine(
    workerLocation.lat, workerLocation.lng,
    jobLocation.lat, jobLocation.lng
  );

  const zona = workerLocation.zona || 'default';
  const baseSpeed = ZONE_SPEEDS[zona] || ZONE_SPEEDS.default;
  const h = hour !== undefined ? hour : new Date().getHours();
  const congestion = CONGESTION_FACTORS[h] || 1.0;
  const effectiveSpeed = baseSpeed / congestion;

  const etaMinutes = Math.round((distanceKm / effectiveSpeed) * 60);

  return { etaMinutes, distanceKm: Math.round(distanceKm * 10) / 10, effectiveSpeed };
}

// Score ETA: 0-1, mayor es mejor (menos tiempo)
// < 15min → 1.0, > 90min → 0.0
function etaScore(etaMinutes) {
  if (etaMinutes <= 15) return 1.0;
  if (etaMinutes >= 90) return 0.0;
  return Math.round((1 - (etaMinutes - 15) / 75) * 100) / 100;
}

module.exports = { estimateETA, etaScore, haversine };
