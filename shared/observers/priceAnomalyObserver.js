'use strict';

/**
 * PRICE ANOMALY OBSERVER — Reactor Layer V1
 *
 * Consumidor puro del bus. Reglas:
 * ✔ Side-effect puro — nunca muta eventos existentes
 * ✔ Micro-batch: acumula en buffer, procesa cada BATCH_INTERVAL_MS
 * ✔ No bloquea persist()
 * ✔ Emite AnomalyDetected via router.publish() cuando MDI > threshold
 */

const baseline = require('../projections/rollingPriceBaseline');

const BATCH_INTERVAL_MS = 2000;   // procesa cada 2 segundos
const MDI_THRESHOLD     = 0.40;   // desviación >40% → anomalía
const MIN_BASELINE_SIZE = 5;      // mínimo eventos antes de detectar

let _router   = null;
let _buffer   = [];
let _timer    = null;
let _active   = false;

function init(router) {
  if (_active) return;
  _router = router;
  _active = true;

  // Suscribirse a PRICE_SUBMITTED
  router.subscribe('PRICE_SUBMITTED', _onPriceSubmitted);

  // Arrancar micro-batch timer
  _timer = setInterval(_processBatch, BATCH_INTERVAL_MS);
  if (_timer.unref) _timer.unref(); // no bloquear process exit

  console.log('[PriceAnomalyObserver] Activo. Batch interval:', BATCH_INTERVAL_MS, 'ms');
}

function _onPriceSubmitted(persisted) {
  if (!persisted) return;
  _buffer.push({ persisted, receivedAt: Date.now() });
}

async function _processBatch() {
  if (!_buffer.length) return;

  const batch = _buffer.splice(0, _buffer.length);

  for (const { persisted, receivedAt } of batch) {
    const e       = persisted.event;
    const payload = e.payload || {};
    const zoneId  = (e.context && e.context.zoneId) || (e.context && e.context.zone) || 'unknown';
    const rubro   = payload.rubro || 'unknown';
    const price   = payload.price;

    if (typeof price !== 'number' || price <= 0) continue;

    // Ingesta en baseline ANTES de calcular (el evento actual no distorsiona)
    const currentBaseline = baseline.getBaseline(zoneId, rubro);
    const windowSize      = baseline.getWindowSize(zoneId, rubro);

    // Ingestar después de leer baseline
    baseline.ingest(zoneId, rubro, price);

    // Sin baseline suficiente → solo acumular
    if (currentBaseline === null || windowSize < MIN_BASELINE_SIZE) continue;

    const deviation = Math.abs(price - currentBaseline) / currentBaseline;

    if (deviation > MDI_THRESHOLD) {
      const detectionLatencyMs = Date.now() - receivedAt;

      await _emitAnomaly({
        originalEventId: e.event_id,
        actorId:         e.actor && e.actor.id,
        zoneId,
        rubro,
        price,
        baseline:        currentBaseline,
        deviation,
        detectionLatencyMs,
        correlationId:   e.correlation_id,
        meta:            e.metadata || {},
      });
    }
  }
}

async function _emitAnomaly(data) {
  const { randomUUID } = require('crypto');
  try {
    await _router.publish({
      event_id:       randomUUID(),
      event_type:     'AnomalyDetected',
      correlation_id: data.correlationId,
      causation:      { event_id: data.originalEventId, event_type: 'PRICE_SUBMITTED' },
      actor:          { id: 'priceAnomalyObserver', role: 'observer' },
      context:        { zoneId: data.zoneId },
      payload: {
        anomalyType:         'price_outlier',
        originalEventId:     data.originalEventId,
        actorId:             data.actorId,
        rubro:               data.rubro,
        price:               data.price,
        baseline:            data.baseline,
        deviationIndex:      data.deviation,
        detectionLatencyMs:  data.detectionLatencyMs,
        source:              data.meta.source || 'production',
        scenario:            data.meta.scenario || null,
      },
      metadata: { emittedBy: 'priceAnomalyObserver' },
    });
    console.log(`[PriceAnomalyObserver] AnomalyDetected | actor:${data.actorId} | dev:${(data.deviation*100).toFixed(1)}% | latency:${data.detectionLatencyMs}ms`);
  } catch (err) {
    console.error('[PriceAnomalyObserver] Error emitiendo AnomalyDetected:', err.message);
  }
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  _active = false;
}

module.exports = { init, stop };
