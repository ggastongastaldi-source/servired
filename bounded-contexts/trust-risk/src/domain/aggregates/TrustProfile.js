'use strict';

const { AggregateRoot }         = require('./AggregateRoot');
const { TrustScore }            = require('../valueObjects/TrustScore');
const { RiskLevel }             = require('../valueObjects/RiskLevel');
const { ProfileStatus }         = require('../valueObjects/ProfileStatus');
const { AlgorithmicConfidence } = require('../valueObjects/AlgorithmicConfidence');
const { DimensionScores }       = require('../valueObjects/DimensionScores');
const { DimensionScore }        = require('../valueObjects/DimensionScore');
const { TrustDimension }        = require('../valueObjects/TrustDimension');
const { Percentage }            = require('../valueObjects/Percentage');
const { Trend }                 = require('../valueObjects/Trend');

const {
  InvalidProfileTransitionError,
  InsufficientConfidenceError,
  DuplicateTrustProfileError,
} = require('../errors');

// ── Domain Event types (internos al contexto) ────────────────────────────────
const EVENTS = {
  CREATED:              'TrustProfileCreated',
  DIMENSION_UPDATED:    'DimensionScoreUpdated',
  SCORE_CONSOLIDATED:   'TrustScoreConsolidated',
  SIGNAL_DETECTED:      'RiskSignalDetected',
  STATUS_CHANGED:       'ProfileStatusChanged',
};

class TrustProfile extends AggregateRoot {

  // ── Constructor privado — usar factory methods ───────────────────────────
  constructor() {
    super();
    this._id         = null;
    this._actorId    = null;
    this._actorType  = null;
    this._scores     = DimensionScores.empty();
    this._score      = TrustScore.INITIAL;
    this._riskLevel  = RiskLevel.MEDIUM;
    this._status     = ProfileStatus.ACTIVE;
    this._confidence = AlgorithmicConfidence.NONE;
    this._policy     = null;   // versión de política activa al momento de crear
    this._createdAt  = null;
    this._updatedAt  = null;
  }

  // ── Getters ──────────────────────────────────────────────────────────────
  get id()         { return this._id; }
  get actorId()    { return this._actorId; }
  get actorType()  { return this._actorType; }
  get scores()     { return this._scores; }
  get score()      { return this._score; }
  get riskLevel()  { return this._riskLevel; }
  get status()     { return this._status; }
  get confidence() { return this._confidence; }
  get createdAt()  { return this._createdAt; }
  get updatedAt()  { return this._updatedAt; }

  // ── Factory: crear nuevo perfil ──────────────────────────────────────────
  static create({ trustProfileId, actorId, actorType, policy, clock }) {
    const profile = new TrustProfile();
    const initialScores = DimensionScores.withDefaults(policy);
    const initialScore  = initialScores.consolidate(policy);

    profile._recordEvent({
      type:          EVENTS.CREATED,
      trustProfileId,
      actorId:       actorId,
      actorType:     actorType.value || actorType,
      initialScore:  initialScore.value,
      policyVersion: policy.version,
      occurredAt:    clock.now().toISOString(),
    });

    return profile;
  }

  // ── Factory: reconstruir desde Event Store ───────────────────────────────
  static rehydrate(events) {
    const profile = new TrustProfile();
    profile._rehydrate(events);
    return profile;
  }

  // ── Aplicar evidencia a una dimensión ───────────────────────────────────
  applyEvidence({ dimension, delta, evidenceId, policyVersion, clock }) {
    const dim       = typeof dimension === 'string' ? TrustDimension.of(dimension) : dimension;
    const existing  = this._scores.get(dim.value)
      || new DimensionScore({ dimension: dim, value: 50, weight: 0.2, trend: 'STABLE', evidenceCount: 0 });
    const updated   = existing.applyDelta(delta, clock.now());

    this._recordEvent({
      type:          EVENTS.DIMENSION_UPDATED,
      trustProfileId: this._id,
      dimension:     dim.value,
      scoreBefore:   existing.score.value,
      scoreAfter:    updated.score.value,
      delta,
      evidenceId,
      policyVersion,
      occurredAt:    clock.now().toISOString(),
    });
  }

  // ── Recalcular score consolidado ─────────────────────────────────────────
  recalculateScore({ policy, clock }) {
    const newScore    = this._scores.consolidate(policy);
    const newRisk     = RiskLevel.fromScore(newScore.value);
    const scoreBefore = this._score.value;

    this._recordEvent({
      type:          EVENTS.SCORE_CONSOLIDATED,
      trustProfileId: this._id,
      scoreBefore,
      scoreAfter:    newScore.value,
      riskLevel:     newRisk.value,
      policyVersion: policy.version,
      occurredAt:    clock.now().toISOString(),
    });
  }

  // ── Cambiar estado del perfil (FSM) ──────────────────────────────────────
  changeStatus({ newStatus, reason, policy, clock }) {
    const next = typeof newStatus === 'string' ? newStatus : newStatus.value;

    // ADR-009: Confidence mínima antes de cuarentena
    if (next === 'QUARANTINED') {
      const minConf = policy.minimumConfidenceForQuarantine || 0.3;
      if (!this._confidence.isSufficientFor(minConf)) {
        throw new InsufficientConfidenceError(this._confidence.value, minConf);
      }
    }

    // FSM valida la transición — lanza InvalidProfileTransitionError si inválida
    this._status.transitionTo(next);

    this._recordEvent({
      type:           EVENTS.STATUS_CHANGED,
      trustProfileId: this._id,
      previousStatus: this._status.value,
      newStatus:      next,
      reason:         reason || null,
      occurredAt:     clock.now().toISOString(),
    });
  }

  // ── Actualizar confianza algorítmica ─────────────────────────────────────
  updateConfidence({ dimensionCoverage, ageWeight, clock }) {
    // La confianza se recalcula — no genera evento propio,
    // se registra como parte del TrustScoreConsolidated.
    // Se actualiza internamente para que changeStatus() pueda consultarla.
    this._confidence = new AlgorithmicConfidence({
      evidenceCount:     this._confidence.evidenceCount + 1,
      dimensionCoverage: dimensionCoverage,
      ageWeight:         ageWeight,
    });
  }

  // ── _applyEvent: reconstruye estado desde cada evento ───────────────────
  _applyEvent(event) {
    switch (event.type) {

      case EVENTS.CREATED: {
        this._id        = event.trustProfileId;
        this._actorId   = event.actorId;
        this._actorType = event.actorType;
        this._score     = TrustScore.of(event.initialScore);
        this._riskLevel = RiskLevel.fromScore(event.initialScore);
        this._status    = ProfileStatus.ACTIVE;
        this._confidence = AlgorithmicConfidence.NONE;
        this._createdAt = event.occurredAt;
        this._updatedAt = event.occurredAt;
        break;
      }

      case EVENTS.DIMENSION_UPDATED: {
        const existing = this._scores.get(event.dimension);
        const weight   = existing ? existing.weight.value : 0.2;
        const updated  = new DimensionScore({
          dimension:    event.dimension,
          value:        event.scoreAfter,
          weight,
          trend:        event.delta >= 0 ? 'IMPROVING' : 'DEGRADING',
          evidenceCount: existing ? existing.evidenceCount + 1 : 1,
          lastUpdatedAt: event.occurredAt,
        });
        this._scores    = this._scores.update(updated);
        this._updatedAt = event.occurredAt;
        break;
      }

      case EVENTS.SCORE_CONSOLIDATED: {
        this._score     = TrustScore.of(event.scoreAfter);
        this._riskLevel = RiskLevel.of(event.riskLevel);
        this._updatedAt = event.occurredAt;
        break;
      }

      case EVENTS.STATUS_CHANGED: {
        this._status    = ProfileStatus.of(event.newStatus);
        this._updatedAt = event.occurredAt;
        break;
      }

      case EVENTS.SIGNAL_DETECTED: {
        // Las señales afectan al RiskCase, no al TrustProfile directamente.
        this._updatedAt = event.occurredAt;
        break;
      }

      default:
        // Evento desconocido — ignorar para forward compatibility.
        break;
    }
  }
}

TrustProfile.EVENTS = EVENTS;
module.exports = { TrustProfile };
