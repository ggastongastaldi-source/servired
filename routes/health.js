// ServiRed — Health Check determinista v2.0
// HEALTHY / DEGRADED / CRITICAL
const router  = require('express').Router();
const mongoose = require('mongoose');
const { monitorEventLoopDelay } = require('perf_hooks');

// Event loop monitor — singleton
let _eldHistogram = null;
function getELD() {
  if (!_eldHistogram) {
    _eldHistogram = monitorEventLoopDelay({ resolution: 20 });
    _eldHistogram.enable();
  }
  return _eldHistogram;
}
getELD(); // iniciar al cargar

router.get('/', async (req, res) => {
  const start = Date.now();
  const services = {};
  const metrics  = {};
  let status = 'HEALTHY';

  // ── 1. MongoDB ───────────────────────────────────────────
  try {
    const readyState = mongoose.connection.readyState;
    if (readyState !== 1) throw new Error('readyState: ' + readyState);
    await mongoose.connection.db.admin().ping();
    services.mongodb = { status: 'UP', readyState };
  } catch(e) {
    services.mongodb = { status: 'DOWN', error: e.message };
    status = 'CRITICAL';
  }

  // ── 2. Outbox lag ────────────────────────────────────────
  try {
    const col = mongoose.connection.db.collection('outbox');
    const pending = await col.countDocuments({ status: { $in: ['PENDING','FAILED'] } });
    const oldest  = await col.findOne({ status: { $in: ['PENDING','FAILED'] } }, { sort: { createdAt: 1 } });
    const ageMs   = oldest ? Date.now() - new Date(oldest.createdAt).getTime() : 0;
    const congested = pending > 50 || ageMs > 5 * 60 * 1000;
    services.outbox = { status: congested ? 'DEGRADED' : 'OK', pending, oldest_age_ms: ageMs };
    if (congested && status === 'HEALTHY') status = 'DEGRADED';
  } catch(e) {
    services.outbox = { status: 'UNKNOWN', error: e.message };
  }

  // ── 3. Event loop lag ────────────────────────────────────
  try {
    const eld = getELD();
    const lagMs = eld.mean / 1e6; // nanosegundos → ms
    const blocked = lagMs > 100;
    metrics.eventLoop = { mean_ms: Math.round(lagMs * 100) / 100, blocked };
    if (blocked && status === 'HEALTHY') status = 'DEGRADED';
  } catch(e) {
    metrics.eventLoop = { error: e.message };
  }

  // ── 4. Governance freshness ──────────────────────────────
  try {
    const lastTick = global._governanceLastTick;
    const ageMs = lastTick ? Date.now() - lastTick : null;
    const stale = ageMs === null || ageMs > 2 * 60 * 1000; // más de 2 min
    services.governance = { status: stale ? 'STALE' : 'OK', last_tick_ago_ms: ageMs };
    if (stale && status === 'HEALTHY') status = 'DEGRADED';
  } catch(e) {
    services.governance = { status: 'UNKNOWN', error: e.message };
  }

  // ── 5. Watchdog freshness ────────────────────────────────
  try {
    const lastCheck = global.watchdogLastCheck;
    const ageMs = lastCheck ? Date.now() - lastCheck : null;
    const uptimeMs = process.uptime() * 1000;
    const stale = ageMs === null ? uptimeMs > 5 * 60 * 1000 : ageMs > 5 * 60 * 1000;
    services.watchdog = { status: stale ? 'STALE' : 'OK', last_check_ago_ms: ageMs };
    if (stale && status === 'HEALTHY') status = 'DEGRADED';
  } catch(e) {
    services.watchdog = { status: 'UNKNOWN', error: e.message };
  }

  // ── 6. Runtime ──────────────────────────────────────────
  try {
    const runtime = require('../runtime');
    const s = runtime.registry.status();
    const bus = runtime.bus.stats();
    services.runtime = { status: 'OK', services: s, bus };
  } catch(e) {
    services.runtime = { status: 'UNAVAILABLE', error: e.message };
  }

  // ── 7. Observer snapshot ────────────────────────────────
  try {
    const snap = global.observerSnapshot;
    if (snap) metrics.observer = { total_events: snap.total_events, throughput_per_min: snap.throughput_per_min, latency: snap.latency, uptime_s: snap.uptime_s };
  } catch(_) {}

  metrics.response_time_ms = Date.now() - start;
  metrics.uptime_s = Math.floor(process.uptime());
  metrics.memory_mb = Math.round(process.memoryUsage().heapUsed / 1024 / 1024);

  const httpStatus = status === 'CRITICAL' ? 503 : 200;
  res.status(httpStatus).json({ status, timestamp: new Date().toISOString(), services, metrics });
});


router.post('/runtime/probe', async (req, res) => {
  try {
    const runtime = require('../runtime');
    await runtime.bus.publish({ type: req.body.type || 'WORKER_ACTIVATED', payload: req.body.payload || { workerId: 'probe-test', source: 'health-probe' }, ts: Date.now() });
    res.json({ ok: true, stats: runtime.bus.stats() });
  } catch(err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});


router.post('/runtime/probe-pipeline', async (req, res) => {
  try {
    const trace = [];
    const { emitEvent } = require('../nexus/events/emitEvent');
    const runtime = require('../runtime');
    const snapBefore = { ...runtime.bus.stats() };
    // Parchear NexusTap temporalmente para capturar si se ejecuta
    const tap = require('../runtime/NexusTap');
    const origTap = tap.tap;
    let tapCalled = false;
    tap.tap = (type, payload) => { tapCalled = true; trace.push('tap:' + type); origTap(type, payload); };
    // Parchear _appendEvent para capturar error
    const nexusModule = require('../nexus/events/emitEvent');
    let appendError = null;
    const origEmit = nexusModule.emitEvent;
    // Envolver con Promise para capturar el error async
    const mongoose = require('mongoose');
    const colTest = mongoose.connection.collection('events');
    let mongoOk = false;
    try { await colTest.findOne({}); mongoOk = true; } catch(e) { appendError = 'mongo:' + e.message; }
    trace.push('mongo-ready:' + mongoOk);
    // Test directo de insertOne para verificar si el índice OCC rechaza el doc
    try {
      const testDoc = { eventId: 'probe-test-' + Date.now(), entityType: 'probe', type: 'WORKER_ACTIVATED', aggregateId: 'debora-probe-direct', sequenceNumber: 999, correlationId: 'probe', causationId: null, rootCauseId: null, version: 1, payload: {}, timestamp: new Date(), metadata: { environment: 'test' } };
      await colTest.insertOne(testDoc);
      trace.push('direct-insert:OK');
      await colTest.deleteOne({ eventId: testDoc.eventId });
    } catch(e) { trace.push('direct-insert:FAIL:' + e.message); }

    // === appendEvent spy ===
    const evModule = require('../nexus/events/emitEvent');
    const originalAppend = evModule._appendEvent;
    global.appendEventSpyInstalled = true;

    if (originalAppend) {
      evModule._appendEvent = async function(event) {
        trace.push('appendEvent-enter');
        try {
          const r = await originalAppend(event);
          trace.push('appendEvent-exit');
          return r;
        } catch(e) {
          trace.push('appendEvent-error:' + e.message);
          throw e;
        }
      };
    } else {
      trace.push('appendEvent-not-exported');
    }

    emitEvent({

      entityType:  req.body.entityType  || 'probe',
      type:        req.body.type        || 'WORKER_ACTIVATED',
      aggregateId: req.body.aggregateId || ('probe-' + Date.now()),
      payload:     req.body.payload     || { workerId: 'probe-test', source: 'pipeline-probe' },
    });
    trace.push('emitEvent-called');
    await new Promise(r => setTimeout(r, 300));
    tap.tap = origTap;
    const snapAfter = { ...runtime.bus.stats() };
    const observerSnap = global.observerSnapshot || null;
    res.json({ ok: true, trace, tapCalled, snapBefore, snapAfter, observerTotal: observerSnap ? observerSnap.total_events : null,
      tapCounter: global.__tapCounter || 0,
      lastTap: global.__lastTap || null
    });
  } catch(err) {
    res.status(500).json({ ok: false, layer: 'full-pipeline', error: err.message });
  }
});


router.get('/runtime/observer', async (req, res) => {
  try {
    const snap = global.observerSnapshot || { total_events: 0, counts: {}, note: 'no snapshot yet' };
    res.json({ ...snap, lastNexusError: global._lastNexusError || null });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
