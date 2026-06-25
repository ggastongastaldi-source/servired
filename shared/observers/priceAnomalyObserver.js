'use strict';
const baseline = require('../projections/rollingPriceBaseline');
const { createEvent } = require('../events/createEvent');

const BATCH_INTERVAL_MS = 2000;
const MDI_THRESHOLD     = 0.40;
const MIN_BASELINE_SIZE = 5;

let _router  = null;
let _buffer  = [];
let _timer   = null;
let _active  = false;

function init(router) {
  if (_active) return;
  _router = router;
  _active = true;
  router.subscribe('PRICE_SUBMITTED', _onPriceSubmitted);
  _timer = setInterval(_processBatch, BATCH_INTERVAL_MS);
  if (_timer.unref) _timer.unref();
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
    const e      = persisted.event;
    const p      = e.payload || {};
    const zoneId = (e.context && e.context.zone) || 'unknown';
    const rubro  = p.rubro || 'unknown';
    const price  = p.price;

    if (typeof price !== 'number' || price <= 0) continue;

    const currentBaseline = baseline.getBaseline(zoneId, rubro);
    const windowSize      = baseline.getWindowSize(zoneId, rubro);
    baseline.ingest(zoneId, rubro, price);

    if (currentBaseline === null || windowSize < MIN_BASELINE_SIZE) continue;

    const deviation = Math.abs(price - currentBaseline) / currentBaseline;
    if (deviation <= MDI_THRESHOLD) continue;

    const detectionLatencyMs = Date.now() - receivedAt;
    const meta = p._meta || {};

    try {
      const anomalyEvent = createEvent({
        type:    'AnomalyDetected',
        actor:   { user_id: 'priceAnomalyObserver', role: 'observer' },
        context: { zone: zoneId, source: 'priceAnomalyObserver' },
        payload: {
          anomalyType:        'price_outlier',
          originalEventId:    e.event_id,
          actorId:            e.actor && e.actor.user_id,
          rubro,
          price,
          baseline:           currentBaseline,
          deviationIndex:     deviation,
          detectionLatencyMs,
          source:             meta.source || 'production',
          scenario:           meta.scenario || null,
        },
        correlationId: e.correlation_id,
        causation:     { event_id: e.event_id, event_type: 'PRICE_SUBMITTED' },
      });
      await _router.publish(anomalyEvent);
      console.log(`[PriceAnomalyObserver] AnomalyDetected | actor:${e.actor && e.actor.user_id} | dev:${(deviation*100).toFixed(1)}% | latency:${detectionLatencyMs}ms`);
    } catch (err) {
      console.error('[PriceAnomalyObserver] Error:', err.message);
    }
  }
}

function stop() {
  if (_timer) { clearInterval(_timer); _timer = null; }
  _active = false;
}

module.exports = { init, stop };
