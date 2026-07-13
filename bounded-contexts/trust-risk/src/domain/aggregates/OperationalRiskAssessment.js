'use strict';

const { RiskLevel }              = require('../valueObjects/RiskLevel');
const { FrictionRecommendation } = require('../valueObjects/FrictionRecommendation');
const { TrustScore }             = require('../valueObjects/TrustScore');

/**
 * OperationalRiskAssessment — objeto de dominio complejo, efímero.
 *
 * ADR-002: NO es un Aggregate con Event Store.
 * Tiene ciclo de vida propio (PENDING → ASSESSED → CONSUMED → EXPIRED)
 * pero persiste en colección separada con TTL index.
 *
 * Responde: ¿qué probabilidad hay de que ESTA operación sea fraudulenta?
 * No modifica TrustProfile. Es una consulta con estado efímero.
 */

const STATUS = ['PENDING','ASSESSED','CONSUMED','EXPIRED'];

class OperationalRiskAssessment {

  constructor({
    assessmentId,
    actorId,
    operationId,
    operationType,
    trustSnapshotScore,
    trustSnapshotConfidence,
    policy,
    clock,
  }) {
    this._assessmentId            = assessmentId;
    this._actorId                 = actorId;
    this._operationId             = operationId;
    this._operationType           = operationType;
    this._trustSnapshotScore      = trustSnapshotScore instanceof TrustScore
      ? trustSnapshotScore : TrustScore.of(trustSnapshotScore);
    this._trustSnapshotConfidence = trustSnapshotConfidence;
    this._policy                  = policy;
    this._signals                 = [];
    this._riskScore               = null;
    this._riskLevel               = null;
    this._recommendation          = null;
    this._reasonCodes             = [];
    this._explanation             = null;
    this._status                  = 'PENDING';
    this._assessedAt              = null;
    this._ttlMs                   = policy.assessmentTtlMs || 300_000; // 5 min default
    this._createdAt               = clock.now();
    this._expiresAt               = new Date(this._createdAt.getTime() + this._ttlMs);
  }

  // ── Getters ──────────────────────────────────────────────────────────────
  get assessmentId()            { return this._assessmentId; }
  get actorId()                 { return this._actorId; }
  get operationId()             { return this._operationId; }
  get operationType()           { return this._operationType; }
  get trustSnapshotScore()      { return this._trustSnapshotScore; }
  get trustSnapshotConfidence() { return this._trustSnapshotConfidence; }
  get riskScore()               { return this._riskScore; }
  get riskLevel()               { return this._riskLevel; }
  get recommendation()          { return this._recommendation; }
  get reasonCodes()             { return [...this._reasonCodes]; }
  get explanation()             { return this._explanation; }
  get status()                  { return this._status; }
  get assessedAt()              { return this._assessedAt; }
  get expiresAt()               { return this._expiresAt; }
  get signals()                 { return [...this._signals]; }

  // ── Agregar señal operacional ─────────────────────────────────────────────
  addSignal(signal) {
    if (this._status !== 'PENDING') throw new Error('Cannot add signals to non-PENDING assessment');
    this._signals.push(signal);
  }

  /**
   * Calcula el riesgo operacional.
   * Lógica determinística: mismo input → mismo output.
   * ADR-003.
   *
   * @param {object} opts
   * @param {Date} opts.now
   */
  assess({ now }) {
    if (this._status !== 'PENDING') throw new Error('Assessment already performed');

    const baseScore    = this._trustSnapshotScore.value;
    const signalImpact = this._calculateSignalImpact(now);
    const rawRisk      = Math.min(100, Math.max(0, 100 - baseScore + signalImpact));

    this._riskScore      = Math.round(rawRisk);
    this._riskLevel      = this._deriveRiskLevel(rawRisk);
    this._recommendation = this._deriveRecommendation();
    this._reasonCodes    = this._buildReasonCodes();
    this._explanation    = this._buildExplanation();
    this._status         = 'ASSESSED';
    this._assessedAt     = now;
  }

  markConsumed() {
    if (this._status !== 'ASSESSED') throw new Error('Can only consume an ASSESSED assessment');
    this._status = 'CONSUMED';
  }

  markExpired() {
    this._status = 'EXPIRED';
  }

  isExpired(now) {
    return now >= this._expiresAt;
  }

  // ── Lógica privada — determinística ──────────────────────────────────────

  _calculateSignalImpact(now) {
    return this._signals.reduce((total, signal) => {
      const elapsed = now - new Date(signal.detectedAt);
      const ttl     = signal.ttlMs || 3_600_000;
      const ratio   = Math.min(1, elapsed / ttl);
      const decayed = signal.weight * (1 - ratio); // LINEAR por defecto
      return total + decayed * 100;
    }, 0);
  }

  _deriveRiskLevel(rawRisk) {
    if (rawRisk >= 80) return RiskLevel.CRITICAL;
    if (rawRisk >= 60) return RiskLevel.HIGH;
    if (rawRisk >= 35) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  _deriveRecommendation() {
    const confidenceOk = this._trustSnapshotConfidence.isSufficientFor(
      this._policy.minimumConfidenceForHardChallenge || 0.4
    );
    switch (this._riskLevel.value) {
      case 'CRITICAL': return confidenceOk
        ? FrictionRecommendation.MANUAL_REVIEW
        : FrictionRecommendation.HARD;
      case 'HIGH':     return confidenceOk
        ? FrictionRecommendation.HARD
        : FrictionRecommendation.SOFT;
      case 'MEDIUM':   return FrictionRecommendation.SOFT;
      default:         return FrictionRecommendation.NONE;
    }
  }

  _buildReasonCodes() {
    const codes = [];
    if (this._trustSnapshotScore.isBelow(40)) codes.push('LOW_TRUST_SCORE');
    if (this._signals.length > 0)             codes.push('ACTIVE_RISK_SIGNALS');
    if (!this._trustSnapshotConfidence.isSufficientFor(0.3)) codes.push('LOW_CONFIDENCE');
    if (this._riskScore > 70)                 codes.push('HIGH_OPERATIONAL_RISK');
    return codes;
  }

  _buildExplanation() {
    return {
      trustSnapshot:  this._trustSnapshotScore.value,
      confidence:     this._trustSnapshotConfidence.value,
      signalCount:    this._signals.length,
      riskScore:      this._riskScore,
      riskLevel:      this._riskLevel.value,
      recommendation: this._recommendation.level,
      reasonCodes:    this._reasonCodes,
      policyVersion:  this._policy.version,
    };
  }

  toSnapshot() {
    return {
      assessmentId:            this._assessmentId,
      actorId:                 this._actorId,
      operationId:             this._operationId,
      operationType:           this._operationType,
      trustSnapshotScore:      this._trustSnapshotScore.value,
      trustSnapshotConfidence: this._trustSnapshotConfidence.value,
      signals:                 this._signals,
      riskScore:               this._riskScore,
      riskLevel:               this._riskLevel ? this._riskLevel.value : null,
      recommendation:          this._recommendation ? this._recommendation.level : null,
      reasonCodes:             this._reasonCodes,
      explanation:             this._explanation,
      status:                  this._status,
      assessedAt:              this._assessedAt,
      expiresAt:               this._expiresAt,
      createdAt:               this._createdAt,
    };
  }
}

module.exports = { OperationalRiskAssessment };
