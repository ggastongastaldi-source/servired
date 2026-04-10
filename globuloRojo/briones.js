// ============================================
// MÉTODO BRIONES - Automarketing del trabajador
// El trabajador no es un recurso, es el motor
// ============================================

function scoreBriones(t) {
  let score = 0;

  // Propuesta de valor — tiene bio descriptiva
  if (t.bio && t.bio.length > 50)      score += 20;
  else if (t.bio && t.bio.length > 20) score += 10;

  // Prueba social — trabajos completados
  score += Math.min((t.trabajosCompletados || 0) * 2, 25);

  // Confianza — verificado por Servired
  if (t.verificado) score += 20;

  // Precio definido
  if (t.tarifaHora) score += 10;

  // Disponibilidad reciente
  const diasInactivo = t.ultimaActividad
    ? (Date.now() - new Date(t.ultimaActividad)) / 86400000
    : 999;
  if (diasInactivo < 1)       score += 15;
  else if (diasInactivo < 7)  score += 8;
  else if (diasInactivo < 30) score += 3;

  // Rating
  score += Math.round((t.rating || 0) * 2);

  return Math.min(score, 100);
}

function rankearTrabajadores(trabajadores) {
  return trabajadores
    .map(t => ({ ...t, scoreBriones: scoreBriones(t) }))
    .sort((a, b) => b.scoreBriones - a.scoreBriones);
}

module.exports = { scoreBriones, rankearTrabajadores };
