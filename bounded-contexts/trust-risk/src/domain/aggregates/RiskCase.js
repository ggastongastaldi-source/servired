'use strict';

const { AggregateRoot }   = require('./AggregateRoot');
const { RiskLevel }       = require('../valueObjects/RiskLevel');
const { InvalidCaseTransitionError } = require('../errors');

const EVENTS = {
  OPENED:   'RiskCaseOpened',
  SIGNAL:   'RiskSignalAdded',
  REVIEWED: 'RiskCaseReviewed',
  RESOLVED: 'RiskCaseResolved',
  ESCALATED:'RiskCaseEscalated',
};

// FSM de RiskCase
const TRANSITIONS = {
  OPEN:         ['INVESTIGATING','RESOLVED','ESCALATED'],
  INVESTIGATING:['RESOLVED','ESCALATED'],
  RESOLVED:     [],
  ESCALATED:    ['RESOLVED'],
};

class RiskCase extends AggregateRoot {

  constructor() {
    super();
    this._id              = null;
    this._trustProfileId  = null;
    this._severity        = null;
    this._status          = 'OPEN';
    this._signals         = [];
    this._resolution      = null;
    this._policyVersion   = null;
    this._openedAt        = null;
    this._resolvedAt      = null;
  }

  // ── Getters ──────────────────────────────────────────────────────────────
  get id()             { return this._id; }
  get trustProfileId() { return this._trustProfileId; }
  get severity()       { return this._severity; }
  get status()         { return this._status; }
  get signals()        { return [...this._signals]; }
  get resolution()     { return this._resolution; }
  get isOpen()         { return ['OPEN','INVESTIGATING'].includes(this._status); }
  get openedAt()       { return this._openedAt; }
  get resolvedAt()     { return this._resolvedAt; }

  // ── Factory ───────────────────────────────────────────────────────────────
  static open({ riskCaseId, trustProfileId, severity, triggeredBy, policyVersion, clock }) {
    const rc = new RiskCase();
    rc._recordEvent({
      type:          EVENTS.OPENED,
      riskCaseId,
      trustProfileId,
      severity:      severity instanceof RiskLevel ? severity.value : severity,
      triggeredBy:   triggeredBy || [],
      policyVersion: policyVersion || 'policy-v1.0.0',
      occurredAt:    clock.now().toISOString(),
    });
    return rc;
  }

  static rehydrate(events) {
    const rc = new RiskCase();
    rc._rehydrate(events);
    return rc;
  }

  // ── Agregar señal ────────────────────────────────────────────────────────
  addSignal({ signalId, signalType, sourceEventId, weight, ttlMs, decayFunction, clock }) {
    this._assertOpen();
    this._recordEvent({
      type:          EVENTS.SIGNAL,
      riskCaseId:    this._id,
      signalId,
      signalType,
      sourceEventId,
      weight,
      ttlMs,
      decayFunction: decayFunction || 'LINEAR',
      occurredAt:    clock.now().toISOString(),
    });
  }

  // ── Marcar como en investigación ─────────────────────────────────────────
  startInvestigation({ clock }) {
    this._assertTransition('INVESTIGATING');
    this._recordEvent({
      type:       EVENTS.REVIEWED,
      riskCaseId: this._id,
      occurredAt: clock.now().toISOString(),
    });
  }

  // ── Resolver ─────────────────────────────────────────────────────────────
  resolve({ resolution, clock }) {
    if (!['CLEARED','CONFIRMED','DEFERRED'].includes(resolution)) {
      throw new Error(`Invalid resolution: ${resolution}`);
    }
    this._assertTransition('RESOLVED');
    // Invariante: debe haber al menos una señal registrada
    if (this._signals.length === 0) {
      throw new Error('Cannot resolve RiskCase with no signals recorded');
    }
    this._recordEvent({
      type:       EVENTS.RESOLVED,
      riskCaseId: this._id,
      resolution,
      occurredAt: clock.now().toISOString(),
    });
  }

  // ── Escalar ──────────────────────────────────────────────────────────────
  escalate({ reason, clock }) {
    this._assertTransition('ESCALATED');
    this._recordEvent({
      type:       EVENTS.ESCALATED,
      riskCaseId: this._id,
      reason:     reason || null,
      occurredAt: clock.now().toISOString(),
    });
  }

  // ── FSM helper ───────────────────────────────────────────────────────────
  _assertTransition(next) {
    if (!TRANSITIONS[this._status].includes(next)) {
      throw new InvalidCaseTransitionError(this._status, next);
    }
  }

  _assertOpen() {
    if (!this.isOpen) {
      throw new Error(`RiskCase ${this._id} is not open (status: ${this._status})`);
    }
  }

  // ── _applyEvent ──────────────────────────────────────────────────────────
  _applyEvent(event) {
    switch (event.type) {
      case EVENTS.OPENED:
        this._id             = event.riskCaseId;
        this._trustProfileId = event.trustProfileId;
        this._severity       = RiskLevel.of(event.severity);
        this._status         = 'OPEN';
        this._policyVersion  = event.policyVersion;
        this._openedAt       = event.occurredAt;
        break;
      case EVENTS.SIGNAL:
        this._signals.push({
          signalId:      event.signalId,
          signalType:    event.signalType,
          sourceEventId: event.sourceEventId,
          weight:        event.weight,
          ttlMs:         event.ttlMs,
          decayFunction: event.decayFunction,
          detectedAt:    event.occurredAt,
        });
        break;
      case EVENTS.REVIEWED:
        this._status = 'INVESTIGATING';
        break;
      case EVENTS.RESOLVED:
        this._status     = 'RESOLVED';
        this._resolution = event.resolution;
        this._resolvedAt = event.occurredAt;
        break;
      case EVENTS.ESCALATED:
        this._status = 'ESCALATED';
        break;
      default:
        break;
    }
  }
}

RiskCase.EVENTS      = EVENTS;
RiskCase.TRANSITIONS = TRANSITIONS;
module.exports = { RiskCase };
