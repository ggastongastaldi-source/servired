# AUDITORÍA FASE IV-D — Insumos para SOC Bloque 2 (Dixie Terminal)
Generado: Wed Jul  1 06:06:46 -03 2026

## Implementación completa: GET /circuit-breaker en admin.js
router.get('/circuit-breaker', authAdmin, (req, res) => {
  try {
    const { getAll } = require('../../../nexus/infrastructure/circuitBreaker');
    res.json({ ok: true, circuits: getAll() });
  } catch(e) { res.json({ ok: true, circuits: [] }); }
});


// Outbox stats
router.get('/outbox/stats', authAdmin, async (req, res) => {

## Implementación completa: GET /chaos/faults
router.get('/chaos/faults', authAdmin, (req, res) => {
  try {
    const { listFaults } = require('../../../nexus/application/chaosLab');
    res.json({ ok: true, faults: listFaults() });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.post('/chaos/inject/:fault', authAdmin, async (req, res) => {
  try {
    const { injectFault } = require('../../../nexus/application/chaosLab');
    const result = await injectFault(req.params.fault);
    res.json({ ok: true, result });
  } catch(e) { res.status(500).json({ ok: false, error: e.message }); }
});

router.get('/chaos/validate', authAdmin, async (req, res) => {

## Modelo PolicyFinding
./src/sinapsis/dixieTerminal/PolicyFinding.js
// PolicyFinding.js — schema de findings de Dixie Gate Terminal
// Colección: dixie_findings — append-only, upsert idempotente por findingId

const mongoose = require('mongoose');

const PolicyFindingSchema = new mongoose.Schema({
  findingId:      { type: String, required: true },   // rule:collection:ref — unique
  rule:           { type: String, required: true },
  severity:       { type: String, enum: ['LOW','MEDIUM','HIGH','CRITICAL'], required: true },
  collection:     { type: String, required: true },   // colección afectada o 'cross'
  detail:         { type: mongoose.Schema.Types.Mixed },
  status:         { type: String, enum: ['OPEN','ACKNOWLEDGED'], default: 'OPEN' },
  detectedAt:     { type: Date, default: Date.now },
  acknowledgedAt: { type: Date },
  resolvedAt:     { type: Date },
  resolution: {
    action:     { type: String },
    reason:     { type: String },
    executedAt: { type: Date },
    evidence:   { type: mongoose.Schema.Types.Mixed }
  }
}, { collection: 'dixie_findings', suppressReservedKeysWarning: true });

PolicyFindingSchema.index({ findingId: 1 }, { unique: true });
PolicyFindingSchema.index({ status: 1, detectedAt: -1 });
PolicyFindingSchema.index({ rule: 1 });

const PolicyFinding = mongoose.models.PolicyFinding ||
  mongoose.model('PolicyFinding', PolicyFindingSchema);

module.exports = { PolicyFinding };

## Modelo SystemState
./src/sinapsis/dixieTerminal/SystemState.js
// SystemState.js — singleton de estado operativo (Sprint 3C-A)
// Colección: system_state — un único documento con _id fijo "global"
// Modo puramente observacional: ningún componente productivo lo consulta todavía.

const mongoose = require('mongoose');

const SystemStateSchema = new mongoose.Schema({
  _id:    { type: String, default: 'global' },
  mode:   { type: String, enum: ['NORMAL', 'DEGRADED'], default: 'NORMAL' },
  reason: { type: String, default: null }
}, { collection: 'system_state', timestamps: true });

const SystemState = mongoose.models.SystemState ||
  mongoose.model('SystemState', SystemStateSchema);

// Helper: obtiene el singleton, creándolo si no existe (lazy init idempotente)
async function getState() {
  let doc = await SystemState.findById('global');
  if (!doc) {
    doc = await SystemState.create({ _id: 'global', mode: 'NORMAL', reason: null });
  }
  return doc;
}

module.exports = { SystemState, getState };

## dixieScanner.js completo (cómo arma openFindings/getState)
// dixieScanner.js — Dixie Gate Terminal Sprint 3A (modo observador)
// Lee eventos, evalúa reglas, persiste findings.
// NO modifica eventos. NO bloquea operaciones. Solo observa y reporta.

const { busReplay }    = require('../../../shared/events/persistenceAdapters/sinapsisBusAdapter');
const { replay: govReplay } = require('../logManagerV2');
const { PolicyFinding } = require('./PolicyFinding');
const { evaluate }       = require('./policyEngine');
const { execute }        = require('./actionExecutor');
const { evaluateCircuitBreaker } = require('./circuitBreaker');
const { SystemState, getState } = require('./SystemState');

// ── Catálogo de reglas ──────────────────────────────────────────
const RULES = {
  GAP_BUS:      { severity: 'HIGH',     collection: 'sinapsis_bus_log' },
  GAP_GOV:      { severity: 'HIGH',     collection: 'sinapsis_log_v2'  },
  HASH_INVALID: { severity: 'CRITICAL', collection: 'sinapsis_bus_log' },
  CHAIN_BROKEN: { severity: 'CRITICAL', collection: 'sinapsis_bus_log' },
  GOV_INVALID:  { severity: 'CRITICAL', collection: 'sinapsis_log_v2'  },
  DIVERGENCE:   { severity: 'MEDIUM',   collection: 'cross'            },
  OUT_OF_ORDER: { severity: 'HIGH',     collection: 'sinapsis_bus_log' }
};

// Upsert idempotente — no genera duplicados si el mismo finding ya existe
async function upsertFinding(findingId, rule, detail) {
  const def = RULES[rule];
  await PolicyFinding.findOneAndUpdate(
    { findingId },
    { $setOnInsert: {
        findingId,
        rule,
        severity:   def.severity,
        collection: def.collection,
        detail,
        status:     'OPEN',
        detectedAt: new Date()
    }},
    { upsert: true }
  );
}

async function scan() {
  const scannedAt = new Date().toISOString();
  const created = [];

  // ── Recolección de datos ────────────────────────────────────
  const [busResult, govResult] = await Promise.all([
    busReplay(1).catch(e => ({ error: e.message, gaps: [], broken: [], total: 0, invalid: 0, gapCount: 0, integrityOk: false })),
    govReplay(1).catch(e => ({ error: e.message, gaps: [], invalid: 0, total: 0, gapCount: 0, integrityOk: false }))
  ]);

  // ── Regla: GAP_BUS ─────────────────────────────────────────
  for (const seq of (busResult.gaps || [])) {
    const id = `GAP_BUS:sinapsis_bus_log:${seq}`;
    await upsertFinding(id, 'GAP_BUS', {
      sequence: seq,
      description: `Gap en sinapsis_bus_log en sequence ${seq} — posible crash entre nextSeq y create`
    });
    created.push(id);
  }

  // ── Regla: GAP_GOV ─────────────────────────────────────────
  for (const seq of (govResult.gaps || [])) {
    const id = `GAP_GOV:sinapsis_log_v2:${seq}`;
    await upsertFinding(id, 'GAP_GOV', {
      sequence: seq,
      description: `Gap en sinapsis_log_v2 en sequence ${seq}`
    });
    created.push(id);
  }

  // ── Regla: HASH_INVALID / CHAIN_BROKEN ─────────────────────
  for (const b of (busResult.broken || [])) {
    if (!b.hashOk) {
      const id = `HASH_INVALID:sinapsis_bus_log:${b.sequence}`;
      await upsertFinding(id, 'HASH_INVALID', {
        sequence: b.sequence,
        eventId:  b.eventId,
        expected: b.expected,
        got:      b.got,
        description: `Hash inválido en sequence ${b.sequence}`
      });
      created.push(id);
    }
    if (!b.chainOk) {
      const id = `CHAIN_BROKEN:sinapsis_bus_log:${b.sequence}`;
      await upsertFinding(id, 'CHAIN_BROKEN', {
        sequence:    b.sequence,
        eventId:     b.eventId,
        description: `prevHash no coincide con entryHash anterior en sequence ${b.sequence}`
      });
      created.push(id);
    }
  }

  // ── Regla: GOV_INVALID ─────────────────────────────────────
  if ((govResult.invalid || 0) > 0) {
    const id = `GOV_INVALID:sinapsis_log_v2:total_${govResult.invalid}`;
    await upsertFinding(id, 'GOV_INVALID', {
      invalidCount: govResult.invalid,
      description:  `${govResult.invalid} entrada(s) con hash inválido en sinapsis_log_v2`
    });
    created.push(id);
  }

  // ── Regla: DIVERGENCE ──────────────────────────────────────
  if (busResult.total === 0 && govResult.total > 0) {
    const id = `DIVERGENCE:cross:bus_empty`;
    await upsertFinding(id, 'DIVERGENCE', {
      busTotal:    0,
      govTotal:    govResult.total,
      description: 'sinapsis_bus_log vacío con sinapsis_log_v2 activo — adapter posiblemente inactivo'
    });
    created.push(id);
  }

  // ── Regla: OUT_OF_ORDER (secuencias fuera de orden) ────────
  // busReplay ya detecta gaps — OUT_OF_ORDER cubre el caso donde
  // el array de entries no viene ordenado por sequence
  if ((busResult.gaps || []).length > 0 && busResult.total > 0) {
    const maxGap = Math.max(...busResult.gaps);
    const id = `OUT_OF_ORDER:sinapsis_bus_log:maxgap_${maxGap}`;
    await upsertFinding(id, 'OUT_OF_ORDER', {
      gaps:        busResult.gaps,
      description: `Secuencias fuera de orden o faltantes detectadas en sinapsis_bus_log`
    });
    created.push(id);
  }

  // ── Policy Engine + Action Executor ────────────────────────────────
  const openFindings = await PolicyFinding.find({ status: 'OPEN' }).lean();
  const metrics = {
    busTotal: busResult.total || 0,
    govTotal: govResult.total || 0
  };
  const decisions    = evaluate(openFindings, metrics);
  const execResults  = await execute(decisions);
  const appliedCount = execResults.filter(r => r.applied).length;

  const openCount = await PolicyFinding.countDocuments({ status: 'OPEN' });

  // ── Sprint 3C-B: Circuit Breaker automático ────────────────────────
  // Reusa openFindings ya cargado arriba — sin query adicional.
  const breakerDecision = await evaluateCircuitBreaker(openFindings, getState, SystemState);

  const status = created.length === 0 ? 'CLEAN' : 'FINDINGS_DETECTED';

  console.log(JSON.stringify({
    level: 'info', source: 'DIXIE_TERMINAL',
    scannedAt, status,
    newFindings: created.length, openFindings: openCount
  }));

  return {
    scannedAt,
    status,
    newFindings:   created.length,
    openFindings:  openCount,
    decisions:     decisions.length,
    actionsApplied: appliedCount,
    circuitBreaker: breakerDecision,
    bus: {
      total:       busResult.total,
      integrityOk: busResult.integrityOk,
      gapCount:    busResult.gapCount || 0
    },
    gov: {
      total:       govResult.total,
      integrityOk: govResult.integrityOk,
      gapCount:    govResult.gapCount || 0
    }
  };
}

module.exports = { scan };

## ¿Quién llama a dixieScanner? (¿corre en cron, endpoint, o solo se invoca manual?)
