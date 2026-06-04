const { haversine } = require('./ETAProvider');

// Radio maximo por categoria de servicio (km)
const MAX_RADIUS_BY_CATEGORY = {
  cerrajero:    15,
  electricista: 25,
  plomero:      20,
  gasista:      20,
  instalador:   35,
  alarmas:      50,
  industrial:   80,
  default:      25,
};

// Rings de expansion progresiva (km)
const EXPANSION_RINGS = [
  { ring: 1, minKm: 0,  maxKm: 5  },
  { ring: 2, minKm: 5,  maxKm: 10 },
  { ring: 3, minKm: 10, maxKm: 20 },
  { ring: 4, minKm: 20, maxKm: 30 },
  { ring: 5, minKm: 30, maxKm: 50 },
];

// Filtrar workers por ring de distancia
function filterByRing(workers, jobLocation, ringIndex) {
  const ring = EXPANSION_RINGS[ringIndex];
  if (!ring) return [];
  if (!jobLocation || !jobLocation.lat) return workers;

  return workers.filter(w => {
    const lat = w.ubicacion?.coordinates?.[1];
    const lng = w.ubicacion?.coordinates?.[0];
    if (!lat || !lng) return false;
    const dist = haversine(lat, lng, jobLocation.lat, jobLocation.lng);
    return dist >= ring.minKm && dist < ring.maxKm;
  });
}

// Obtener rings aplicables segun categoria
function getRingsForCategory(category) {
  const maxKm = MAX_RADIUS_BY_CATEGORY[category] || MAX_RADIUS_BY_CATEGORY.default;
  return EXPANSION_RINGS.filter(r => r.minKm < maxKm);
}

// Expansion progresiva: devuelve workers ordenados por ring
function expandCandidates(workers, jobLocation, category) {
  const rings = getRingsForCategory(category);
  const result = [];
  const seen = new Set();

  for (const ring of rings) {
    const ringWorkers = filterByRing(workers, jobLocation, ring.ring - 1);
    for (const w of ringWorkers) {
      const id = w._id.toString();
      if (!seen.has(id)) {
        seen.add(id);
        result.push({ ...w._doc || w, _ring: ring.ring });
      }
    }
    if (result.length > 0) break; // parar en el primer ring con candidatos
  }

  return result;
}

module.exports = { expandCandidates, getRingsForCategory, MAX_RADIUS_BY_CATEGORY, EXPANSION_RINGS };
