// ServiRed — NEXUS Auction Engine v1.0
// Real-time workforce auction optimized for attention allocation
// NO es un sistema de notificaciones. Es una subasta de atención humana.

const { emitEvent } = require('../events/emitEvent');

// ── THRESHOLDS ───────────────────────────────────────────────
const T = {
  WINNER:    0.85, // HARD DISPATCH
  SECONDARY: 0.70, // SOFT OFFER
  BACKUP:    0.50, // SILENT QUEUE
  // < 0.50 → IGNORE
};

// ── BID SCORE CALCULATOR ─────────────────────────────────────
function calcBidScore({ affinity, availability, contextStability, demandFit }) {
  return (
    (affinity        || 0) * 0.40 +
    (availability    || 0) * 0.25 +
    (contextStability|| 0) * 0.15 +
    (demandFit       || 0) * 0.20
  );
}

// ── AFFINITY SCORE ───────────────────────────────────────────
function calcAffinity(worker, rubroRequerido) {
  const esp = (worker.especialidades || []).map(e => e.toLowerCase());
  const rubro = (rubroRequerido || '').toLowerCase();
  if (esp.includes(rubro)) return 1.0;          // match primario
  if (esp.some(e => e.includes(rubro) || rubro.includes(e))) return 0.7; // match secundario
  return 0.0;
}

// ── AVAILABILITY SCORE ───────────────────────────────────────
function calcAvailability(worker) {
  if (!worker.disponible) return 0;
  const rating = Math.min(1, (worker.rating || 3) / 5);
  const completados = Math.min(1, (worker.trabajosCompletados || 0) / 50);
  return (rating * 0.6) + (completados * 0.4);
}

// ── DEMAND FIT ───────────────────────────────────────────────
function calcDemandFit(worker, pedido) {
  // Distancia — más cerca = mejor fit
  if (!pedido.lat || !pedido.lon || !worker.ubicacion) return 0.5;
  try {
    const { haversine } = require('../../globuloRojo/haversine');
    const [wLon, wLat] = worker.ubicacion.coordinates || [0, 0];
    const dist = haversine(pedido.lat, pedido.lon, wLat, wLon);
    if (dist <= 3)  return 1.0;
    if (dist <= 8)  return 0.8;
    if (dist <= 20) return 0.6;
    if (dist <= 50) return 0.3;
    return 0.1;
  } catch(e) { return 0.5; }
}

// ── CONTEXT STABILITY (windowed) ─────────────────────────────
function calcContextStability(worker) {
  // Por ahora usa verificado + rating como proxy de estabilidad
  const verificado = worker.verificado || worker.estado === 'VERIFICADO' ? 0.4 : 0;
  const rating = Math.min(0.6, ((worker.rating || 3) - 1) / 4 * 0.6);
  return verificado + rating;
}

// ── MAIN AUCTION ─────────────────────────────────────────────
async function subastar({ pedido, workers }) {
  if (!workers || !workers.length) {
    return { winner: null, bids: [], expanded: false };
  }

  // Calcular bid score para cada worker
  let bids = workers.map(w => {
    const affinity         = calcAffinity(w, pedido.tipoServicio);
    const availability     = calcAvailability(w);
    const contextStability = calcContextStability(w);
    const demandFit        = calcDemandFit(w, pedido);
    const score            = calcBidScore({ affinity, availability, contextStability, demandFit });

    return {
      worker: w,
      workerId: String(w._id),
      nombre: w.nombre,
      score: Math.round(score * 1000) / 1000,
      breakdown: { affinity, availability, contextStability, demandFit },
      action: score >= T.WINNER    ? 'HARD_DISPATCH'  :
              score >= T.SECONDARY ? 'SOFT_OFFER'     :
              score >= T.BACKUP    ? 'BACKUP_QUEUE'   : 'IGNORE',
    };
  });

  // Ordenar por score desc
  bids.sort((a, b) => b.score - a.score);

  const winner    = bids.find(b => b.score >= T.WINNER);
  const secondary = bids.find(b => b.score >= T.SECONDARY && b.score < T.WINNER);

  // Expansion logic — si no hay winner, expandir a habilidades secundarias
  let expanded = false;
  if (!winner) {
    expanded = true;
    // Re-calcular con affinity relajada (0.5 base para cualquier match)
    bids = bids.map(b => {
      if (b.score < T.SECONDARY && b.breakdown.affinity > 0) {
        const newScore = calcBidScore({
          affinity: Math.max(b.breakdown.affinity, 0.5),
          availability: b.breakdown.availability,
          contextStability: b.breakdown.contextStability,
          demandFit: b.breakdown.demandFit,
        });
        return { ...b, score: Math.round(newScore * 1000) / 1000,
          action: newScore >= T.WINNER ? 'HARD_DISPATCH' : newScore >= T.SECONDARY ? 'SOFT_OFFER' : 'BACKUP_QUEUE',
          expanded: true };
      }
      return b;
    });
    bids.sort((a, b) => b.score - a.score);
  }

  const result = {
    pedidoId: String(pedido._id),
    rubro:    pedido.tipoServicio,
    zona:     pedido.zona,
    winner:   bids.find(b => b.action === 'HARD_DISPATCH') || null,
    secondary:bids.find(b => b.action === 'SOFT_OFFER')    || null,
    backup:   bids.filter(b => b.action === 'BACKUP_QUEUE').slice(0, 3),
    bids:     bids.slice(0, 10),
    expanded,
    timestamp: new Date(),
  };

  // Log limpio tipo Uber
  console.log(`[AuctionEngine] 🔨 Job: ${String(pedido._id).slice(-4)}`);
  if (result.winner)    console.log(`  ✅ Winner:  ${result.winner.nombre} | Score: ${result.winner.score} | HARD DISPATCH`);
  if (result.secondary) console.log(`  🟡 Second:  ${result.secondary.nombre} | Score: ${result.secondary.score} | SOFT OFFER`);
  if (expanded)         console.log(`  🔄 Expanded auction (sin winner directo)`);

  // Emitir evento al Nexus
  emitEvent({
    entityType: 'auction',
    type: 'AUCTION_COMPLETED',
    aggregateId: String(pedido._id),
    payload: {
      winner:    result.winner    ? { id: result.winner.workerId, score: result.winner.score }    : null,
      secondary: result.secondary ? { id: result.secondary.workerId, score: result.secondary.score } : null,
      expanded,
      totalBids: bids.length,
    },
  });

  return result;
}

// ── DISPATCH LAYER ───────────────────────────────────────────
function dispatch({ result, io, pedidoId }) {
  if (!io) return;

  if (result.winner) {
    // HARD INTERRUPT — sonido + vibración fuerte
    io.to('worker_' + result.winner.workerId).emit('nueva_oportunidad', {
      pedidoId,
      tipo: 'HARD_DISPATCH',
      score: result.winner.score,
      vibracion: [300, 100, 300, 100, 300],
      prioridad: 'ALTA',
    });
  }

  if (result.secondary) {
    // SOFT ALERT
    io.to('worker_' + result.secondary.workerId).emit('nueva_oportunidad', {
      pedidoId,
      tipo: 'SOFT_OFFER',
      score: result.secondary.score,
      vibracion: [100],
      prioridad: 'MEDIA',
    });
  }

  // BACKUP — silent queue (sin notificación activa)
  result.backup.forEach(b => {
    io.to('worker_' + b.workerId).emit('nueva_oportunidad', {
      pedidoId,
      tipo: 'SOFT_OFFER',
      score: b.score,
    });
  });
}

module.exports = { subastar, dispatch, calcBidScore, T };
