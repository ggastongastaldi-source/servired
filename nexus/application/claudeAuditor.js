// ServiRed — Shadow Arbitration Auditor v2.0
// Groq como auditor de NEXUS — production-grade
// Fixes: parser defensivo, fallback UNKNOWN, sanitización, deduplicación

const groqService = require('../../src/old_structure/services/groqService');
const { emitEvent } = require('../events/emitEvent');

// ── AUDIT THROTTLE — evita tormenta de autopsias ─────────────
const _lastAutopsy = new Map();
const AUTOPSY_COOLDOWN_MS = 5 * 60 * 1000; // 5 min por circuito

function _throttled(circuitId) {
  const last = _lastAutopsy.get(circuitId);
  if (last && Date.now() - last < AUTOPSY_COOLDOWN_MS) return true;
  _lastAutopsy.set(circuitId, Date.now());
  return false;
}

// ── PARSER DEFENSIVO ─────────────────────────────────────────
function _parseGroqJSON(raw, requiredKeys = []) {
  try {
    const matches = [...(raw||'').matchAll(/\{[\s\S]*?\}/g)];
    for (const m of matches) {
      try {
        const obj = JSON.parse(m[0]);
        if (requiredKeys.every(k => k in obj)) return { ok: true, data: obj };
      } catch(_) {}
    }
    return { ok: false, error: 'No se encontró JSON válido' };
  } catch(e) {
    return { ok: false, error: e.message };
  }
}

// ── SANITIZADOR — evita prompt injection ─────────────────────
function _sanitize(obj, maxStrLen = 200) {
  if (!obj) return obj;
  if (typeof obj === 'string') return obj.slice(0, maxStrLen).replace(/[<>{}]/g, '');
  if (Array.isArray(obj)) return obj.slice(0, 10).map(i => _sanitize(i, maxStrLen));
  if (typeof obj === 'object') {
    const safe = {};
    const allowedKeys = ['rubro','zona','precio','estado','nombre','rating',
      'trabajosCompletados','verificado','distancia','score','circuitId'];
    for (const k of allowedKeys) {
      if (k in obj) safe[k] = _sanitize(obj[k], maxStrLen);
    }
    return safe;
  }
  return obj;
}

// ── DB SINGLETON SEGURO ──────────────────────────────────────
function _getCol(name) {
  const mongoose = require('mongoose');
  if (mongoose.connection.readyState !== 1) throw new Error('MongoDB no conectado');
  return mongoose.connection.collection(name);
}

// ── SHADOW ARBITRATION AUDIT ─────────────────────────────────
async function auditarDispatch({ pedido, workersRankeados, workerSeleccionado, zona }) {
  const FALLBACK = { aprobado: null, confianza: 0, razon: 'Auditor no disponible', alerta: 'UNKNOWN_AUDIT_STATE' };

  try {
    const snapshot = _sanitize({
      pedido: { rubro: pedido.tipoServicio, zona: pedido.zona||zona, precio: pedido.precio, estado: pedido.estado },
      candidatos: (workersRankeados||[]).slice(0,5).map(w => _sanitize(w)),
      seleccionado: workerSeleccionado ? _sanitize(workerSeleccionado) : null,
    });

    const prompt = `Sos el Auditor de NEXUS para ServiRed Argentina.
Analizá si la selección de worker es óptima bajo: impacto marginal sistémico, calidad de servicio, eficiencia de zona.

SNAPSHOT: ${JSON.stringify(snapshot)}

Respondé SOLO con un JSON válido sin texto extra:
{"aprobado":true,"confianza":0.85,"razon":"texto","alerta":null,"recomendacion":null}`;

    const raw = await groqService.inferir(prompt, 250);
    const parsed = _parseGroqJSON(raw, ['aprobado','confianza','razon']);

    if (!parsed.ok) {
      console.warn('[ShadowAuditor] Parser falló:', parsed.error);
      return FALLBACK;
    }

    const result = parsed.data;

    // Persistir async — no bloquea
    _getCol('arbitration_audits').insertOne({
      timestamp: new Date(),
      pedidoId: String(pedido._id),
      snapshot,
      audit: result,
    }).catch(e => console.error('[ShadowAuditor] DB write error:', e.message));

    if (!result.aprobado || result.confianza < 0.4) {
      emitEvent({
        entityType: 'arbitration',
        type: 'DISPATCH_ANOMALY_DETECTED',
        aggregateId: String(pedido._id),
        payload: { audit: result },
      });
      console.warn(`[ShadowAuditor] ⚠️ Anomalía: ${result.alerta}`);
    } else {
      console.log(`[ShadowAuditor] ✅ Dispatch OK (confianza: ${result.confianza})`);
    }

    return result;

  } catch(e) {
    console.error('[ShadowAuditor] Error:', e.message);
    return FALLBACK;
  }
}

// ── CHAOS FORENSIC LAB ───────────────────────────────────────
async function autopsiaForense({ circuitId, estado, traceLogs, duracionMs }) {
  const FALLBACK = { causaRaiz: 'No determinada', resumenEjecutivo: 'Auditor no disponible', riesgoRecurrencia: 'desconocido' };

  // Throttle — evita tormenta de autopsias
  if (_throttled(circuitId)) {
    console.log(`[ForensicLab] ⏳ Autopsia throttled para ${circuitId}`);
    return FALLBACK;
  }

  try {
    const safeLogs = _sanitize(traceLogs||[]);

    const prompt = `Sos el Analista Forense de NEXUS para ServiRed Argentina.
CIRCUITO: ${circuitId} | ESTADO: ${estado} | DURACIÓN: ${duracionMs}ms
TRACE: ${JSON.stringify(safeLogs).slice(0, 800)}

Respondé SOLO con JSON válido sin texto extra:
{"causaRaiz":"texto","patron":"nombre","mrpDebioDetectar":false,"ajustesPolitica":["ajuste"],"riesgoRecurrencia":"bajo","resumenEjecutivo":"párrafo"}`;

    const raw = await groqService.inferir(prompt, 400);
    const parsed = _parseGroqJSON(raw, ['causaRaiz','resumenEjecutivo']);

    if (!parsed.ok) {
      console.warn('[ForensicLab] Parser falló:', parsed.error);
      return FALLBACK;
    }

    const autopsia = parsed.data;

    // Persistir async
    _getCol('forensic_autopsies').insertOne({
      timestamp: new Date(),
      circuitId,
      estado,
      duracionMs,
      autopsia,
    }).catch(e => console.error('[ForensicLab] DB write error:', e.message));

    emitEvent({
      entityType: 'forensic',
      type: 'AUTOPSY_COMPLETED',
      aggregateId: circuitId,
      payload: autopsia,
    });

    const io = global._io;
    if (io) io.to('admins').emit('forensic_autopsy', { circuitId, autopsia, timestamp: new Date() });

    console.log(`[ForensicLab] 🔬 Autopsia: ${autopsia.causaRaiz} | Riesgo: ${autopsia.riesgoRecurrencia}`);
    return autopsia;

  } catch(e) {
    console.error('[ForensicLab] Error:', e.message);
    return FALLBACK;
  }
}

async function getAudits(limit = 10) {
  return _getCol('arbitration_audits').find({}).sort({ timestamp:-1 }).limit(limit).toArray();
}

async function getAutopsies(limit = 10) {
  return _getCol('forensic_autopsies').find({}).sort({ timestamp:-1 }).limit(limit).toArray();
}

module.exports = { auditarDispatch, autopsiaForense, getAudits, getAutopsies };
