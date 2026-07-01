# AUDITORÍA V2 — Médico/Police/Fiscal/Defensor/Juez/Jurisprudencia
Generado: Wed Jul  1 10:55:09 -03 2026

## /api/health completo (candidato a 'Médico del Sistema')
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
      trace.push('direct-insert:DISABLED');
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

## ¿Existe algún modelo o servicio de 'Case', 'Incident', 'Diagnostico'?
./src/core/models/FinancialIncident.js

## ¿Existe algún 'runbook', 'autofix', 'autoheal', 'recovery'?
./src/dispatch/services/RecoveryService.js
./src/sinapsis/crashRecovery.js

## GlobuloRojo watchdog — qué monitorea
const Pedido  = require('../src/core/models/Pedido');
const { runShadow } = require('../src/dispatch/shadow');
const Usuario = require('../src/core/models/Usuario');
const { normalizar } = require('../src/core/utils/normalizer');

const INTERVALO_MS     = 3 * 60 * 1000;  // patrol cada 3 min
const UMBRAL_HUERFANO  = 4 * 60 * 1000;  // pedido huerfano tras 4 min
const MUERTE_DIGNA_MS  = 20 * 60 * 1000; // cancelacion automatica a 20 min
const MAX_RETRY        = 3;


// ── Push offline nueva_oportunidad ───────────────────────────
async function _pushNuevaOportunidad(workerId, pedido) {
  try {
    const webpush = require('web-push');
    const Usuario = require('./src/core/models/Usuario');
    const worker = await Usuario.findById(workerId).lean();
    if (!worker?.pushSubscription) return;
    webpush.setVapidDetails(
      'mailto:admin@servired.online',
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    await webpush.sendNotification(worker.pushSubscription, JSON.stringify({
      tipo:  'nueva_oportunidad',
      title: '🔔 ServiRed — Nuevo trabajo',
      body:  'Pedido de ' + (pedido?.tipoServicio||'servicio') + ' cerca tuyo. ¡Aceptalo ahora!',
      tag:   'nop_' + String(workerId),
      url:   '/trabajador.html',
    }));
  } catch(e) { /* worker sin push suscripción */ }
}

async function buscarCandidatos(pedido) {
  const rubroNorm = normalizar(pedido.tipoServicio);
  return await Usuario.find({
    rol: { $in: ["TRABAJADOR","WORKER"] },
    rubro: { $regex: rubroNorm, $options: "i" },
    disponible: true,
    _id: { $nin: pedido.ignoredBy || [] }
  }).limit(10).lean();
}

async function emitirAlerta(pedido, workers, urgente) {
  // SHADOW MODE — DispatchEngine corre en paralelo, nunca bloquea GR
  runShadow(pedido, workers).catch(() => {});
  const io = global.io;
  if (!io) return;
  const payload = {
    pedidoId:    pedido._id,
    tipoServicio: pedido.tipoServicio,
    zona:        pedido.zona,
    precio:      pedido.total_estimado,
    pagoWorker:  pedido.pago_worker,
    descripcion: pedido.descripcion,
    direccion:   pedido.direccion,
    urgente:     !!urgente,
    expiraEn:    300,
    retryLevel:  pedido.retryLevel
  };
  // Emision dual garantizada
  workers.forEach(w => {
    _pushNuevaOportunidad(w._id, payload).catch(()=>{});
          io.to("worker_" + w._id).emit("nueva_oportunidad", payload);
  });
  io.to("rubro_" + pedido.tipoServicio).emit("nueva_oportunidad", payload);
  io.to("zona_"  + pedido.zona).emit("nueva_oportunidad", payload);
}

function alertarAdmin(mensaje) {
  const io = global.io;
  if (io) io.to("admins").emit("alerta_critica", { mensaje, timestamp: new Date() });
  console.error("[WATCHDOG] CRITICO:", mensaje);
}

async function patrol() {
  global.watchdogLastCheck = Date.now();
  try {
    const ahora = new Date();

    // 1. MUERTE DIGNA: pedidos huerfanos > 20 min
    const muertos = await Pedido.find({
      estado: "PENDIENTE",
      createdAt: { $lt: new Date(ahora - MUERTE_DIGNA_MS) }
    });
    for (const p of muertos) {
      await Pedido.findByIdAndUpdate(p._id, {
        estado: "CANCELADO_SISTEMA",
        $push: { historialEstados: { estado: "CANCELADO_SISTEMA", fecha: ahora } }
      });
      const io = global.io;
      if (io) {
        io.to("pedido_" + p._id).emit("estado_pedido", {
          fase: "CANCELADO_SISTEMA",
          titulo: "Sin respuesta",
          mensaje: "No encontramos especialistas disponibles. Tu pedido fue cancelado automaticamente."
        });
      }
      console.log("[WATCHDOG] Muerte digna:", p._id);
    }

    // 2. WATCHDOG: pedidos huerfanos 4-20 min
    const huerfanos = await Pedido.find({
      estado: "PENDIENTE",
      updatedAt: { $lt: new Date(ahora - UMBRAL_HUERFANO) },
      retryLevel: { $lt: MAX_RETRY },
      createdAt:  { $gt: new Date(ahora - MUERTE_DIGNA_MS) }
    });

    for (const pedido of huerfanos) {
      pedido.retryLevel = (pedido.retryLevel || 0) + 1;
      const urgente     = pedido.retryLevel >= 2;
      const candidatos  = await buscarCandidatos(pedido);

      if (candidatos.length > 0) {
        await emitirAlerta(pedido, candidatos, urgente);
        console.log("[WATCHDOG] Pedido " + pedido._id + " re-notificado nivel " + pedido.retryLevel + " (" + candidatos.length + " workers)");
      } else if (pedido.retryLevel >= MAX_RETRY) {
        alertarAdmin("Pedido CRITICO sin workers disponibles: " + pedido._id + " (" + pedido.tipoServicio + ")");
      }

      pedido.lastNotifiedAt = ahora;
      await pedido.save();
    }

    if (huerfanos.length > 0 || muertos.length > 0) {
      console.log("[WATCHDOG] Ciclo: " + huerfanos.length + " reintentados, " + muertos.length + " cancelados");
    }

  } catch(e) {
    console.error("[WATCHDOG] Error en patrol:", e.message);
  }
}

function iniciar() {
  global.watchdogLastCheck = Date.now();
  console.log("[WATCHDOG] Globulo Rojo v2.1 iniciado - patrol cada 3 min");
  global.watchdogLastCheck = Date.now();
  setInterval(patrol, INTERVALO_MS);
  // Primera patrol al minuto de arrancar
  setTimeout(patrol, 60000);
}


// ════════════════════════════════════════
// QUARANTINE — Limpieza cada 12hs
// ════════════════════════════════════════
const cleanHouse = async () => {
  try {
    const mongoose = require('mongoose');
    const db = mongoose.connection;
    const ahora = new Date();

    const trash = await Pedido.find({
      $or: [
        { total_estimado: { $in: [0, null] } },
        { estado: 'CANCELADO_SISTEMA',
          updatedAt: { $lt: new Date(ahora - 7 * 24 * 60 * 60 * 1000) } }
      ]
    });

    if (trash.length > 0) {
      const col = db.collection('quarantine_orders');
      await col.insertMany(trash.map(t => ({
        ...t.toObject(),
        archivedAt: ahora,
        reason: (!t.total_estimado || t.total_estimado === 0)
          ? 'precio_invalido'
          : 'cancelado_viejo'
      })));
      const ids = trash.map(t => t._id);
      await Pedido.deleteMany({ _id: { $in: ids } });
      console.log('[CLEANHOUSE] ' + trash.length + ' pedidos → quarantine_orders');
    }
  } catch(e) {
    console.error('[CLEANHOUSE] Error:', e.message);
  }
};

setInterval(cleanHouse, 12 * 60 * 60 * 1000);
setTimeout(cleanHouse, 5 * 60 * 1000); // Primer barrido a los 5 min

module.exports = { iniciar, patrol, cleanHouse };

## FinanceWatchdog — patrón de auditoría periódica (posible plantilla para Médico)
const { v4: uuidv4 } = require('uuid');
const { runForensicAudit }   = require('./financeEngine');
const FinancialIncident      = require('../models/FinancialIncident');
const FinanceWatchdogStatus  = require('../models/FinanceWatchdogStatus');

const INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

// Lock local — protege contra ejecuciones solapadas
let watchdogRunning = false;

// Mapa de severidad por tipo de issue
function resolveSeverity(issue) {
  if (issue === 'LEDGER_IMBALANCE')    return 'CRITICAL';
  if (issue === 'NO_LEDGER_ENTRIES')   return 'CRITICAL';
  return 'WARNING';
}

async function runWatchdog() {
  if (watchdogRunning) {
    console.log('[WATCHDOG] Ejecucion solapada detectada — saltando ciclo');
    return;
  }
  watchdogRunning = true;

  try {
    // 1. Heartbeat: marcar inicio de corrida
    await FinanceWatchdogStatus.findOneAndUpdate(
      { service: 'FinanceWatchdog' },
      { last_run_at: new Date() },
      { upsert: true, returnDocument: 'after' }
    );

    // 2. Ejecutar auditoría forense
    const issues = await runForensicAudit();

    // 3. Procesar cada issue detectado
    const detectedKeys = new Set();

    for (const issue of issues) {
      const { transaction_id, issue: issueType, balance } = issue;

## ¿Hay chequeo de servicios externos (Google OAuth, Mercado Pago) en algún lado?
./nexus/initNexus.js
./routes/boost.js
./server.js
./src/core/models/Payment.js
./src/core/routes/auth.js
./src/core/routes/pagos.js
./src/core/services/mercadoPagoService.js
./src/engine/paymentRoutes.js
./test-sinapsis.js
./tests/financeIdempotency.test.js

## PolicyFinding — ¿tiene ya noción de agrupación/Case, o es solo finding individual?
