/**
 * B19 Control Plane Gateway
 * Punto de entrada único para el sistema económico de ServiRed.
 *
 * Responsabilidades:
 *   OBSERVE  → agrega estado desde Event Store + sockets
 *   DECIDE   → delega a policyEngine + scoringEngine
 *   ACT      → despacha a dispatchEngine + financeEngine
 *
 * Invariante de acoplamiento:
 *   Ningún módulo importa a otro directamente para decisiones económicas.
 *   Todo pasa por este gateway. Esto evita ciclos de dependencia.
 *
 * Flujo completo:
 *   evento_entrada → buildContext() → evaluate() → act() → emitSINAPSIS()
 */

'use strict';
const { buildContext: _buildCtx, evaluateRules } = require('./policyEvaluator');

const EventEmitter = require('events');
const policyEngine = require('./policyEngine');

// ── Importaciones lazy para evitar acoplamiento circular en arranque
let _financeEngine, _dispatchEngine, _sinapsisEmit;

function _finance()  { return _financeEngine  || (_financeEngine  = require('./financeEngine')); }
function _dispatch() { return _dispatchEngine || (_dispatchEngine = require('../globuloRojo/dispatchEngine')); }
function _sinapsis() {
  if (_sinapsisEmit) return _sinapsisEmit;
  try {
    const s = require('./sinapsisService');
    _sinapsisEmit = s.emitEvent?.bind(s) || (() => {});
  } catch { _sinapsisEmit = () => {}; }
  return _sinapsisEmit;
}

// ── Métricas internas en memoria (projection ligera)
const _metrics = {
  totalDecisions:   0,
  policyHits:       0,
  rollbacks:        0,
  freezeEvents:     0,
  lastDecision:     null,
  pricingBreakdowns: [],   // ring buffer últimas 100
};

const MAX_BREAKDOWN_HISTORY = 100;

class ControlPlaneGateway extends EventEmitter {
  constructor() {
    super();
    this._frozen = false;       // freeze global de emergencia
    this._shadowOnly = false;   // modo shadow: evalúa pero no actúa
  }

  // ──────────────────────────────────────────────────────────────────────────
  // OBSERVE — buildContext
  // Construye el contexto de decisión a partir de los inputs del evento.
  // ──────────────────────────────────────────────────────────────────────────
  buildContext(event) {
    return _buildCtx(event);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ACT — execute
  // Aplica la decisión: dispatch + finance + SINAPSIS emit.
  // En shadowOnly: loguea pero no ejecuta efectos reales.
  // ──────────────────────────────────────────────────────────────────────────
  async execute(decision, ctx) {
    if (this._frozen) {
      this.emit('gateway_frozen', { ctx });
      return { ok: false, reason: 'gateway_global_freeze' };
    }

    if (decision.frozen) {
      // Emitir evento al Event Store y salir
      _sinapsis()({
        type:      'dispatch_frozen',
        payload:   { reason: decision.reason, pedidoId: ctx.pedidoId, zona: ctx.zona },
        source:    'control_plane_gateway',
      });
      return { ok: true, skipped: true, reason: decision.reason };
    }

    if (this._shadowOnly) {
      // Shadow mode: evaluar pero no actuar
      this.emit('shadow_decision', { decision, ctx });
      _sinapsis()({
        type:    'shadow_gateway_evaluated',
        payload: { pricing: decision.pricing, appliedRules: decision.appliedRules },
        source:  'control_plane_gateway',
      });
      return { ok: true, shadow: true };
    }

    const results = {};

    // ── Emitir resultado al Event Store (siempre fire-and-forget)
    _sinapsis()({
      type:    'control_plane_decision',
      payload: {
        pedidoId:     ctx.pedidoId,
        pricing:      decision.pricing,
        appliedRules: decision.appliedRules,
        shadowHits:   decision.shadowActions?.length || 0,
      },
      source: 'control_plane_gateway',
    });

    results.sinapsisEmitted = true;
    return { ok: true, results };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ENTRY POINT — process(event)
  // Orquesta el flujo completo: buildContext → evaluate → execute
  // ──────────────────────────────────────────────────────────────────────────
  async process(event) {
    const ctx      = await this.buildContext(event);
    const decision = await this.evaluate(ctx);
    const result   = await this.execute(decision, ctx);
    return { ctx, decision, result };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // CONTROL GLOBAL
  // ──────────────────────────────────────────────────────────────────────────
  freeze()        { this._frozen    = true;  this.emit('global_freeze_activated'); }
  unfreeze()      { this._frozen    = false; this.emit('global_freeze_lifted'); }
  setShadow(v)    { this._shadowOnly = !!v; }

  rollback(ruleId) {
    _metrics.rollbacks++;
    return policyEngine.rollbackRule(ruleId);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // METRICS — para el dashboard B19
  // ──────────────────────────────────────────────────────────────────────────
  getMetrics() {
    const breakdowns = _metrics.pricingBreakdowns;
    const avgPrice = breakdowns.length
      ? Math.round(breakdowns.reduce((s, b) => s + (b.finalPrice || 0), 0) / breakdowns.length)
      : 0;

    return {
      totalDecisions:  _metrics.totalDecisions,
      policyHits:      _metrics.policyHits,
      rollbacks:       _metrics.rollbacks,
      freezeEvents:    _metrics.freezeEvents,
      lastDecision:    _metrics.lastDecision,
      avgPriceLast100: avgPrice,
      frozen:          this._frozen,
      shadowOnly:      this._shadowOnly,
    };
  }
}

// Singleton
const gateway = new ControlPlaneGateway();
module.exports = gateway;
