'use strict';
/**
 * EconomicActor — Agregado central del BC Economic Identity.
 *
 * Representa a cualquier participante del ecosistema ServiRed
 * en tanto actor económico verificable: WORKER, MERCHANT,
 * MANUFACTURER, CLIENT, DISTRIBUTOR.
 *
 * Invariantes:
 * - Un actor no puede operar si está SUSPENDED o REVOKED.
 * - La capacidad económica solo puede actualizarse en estado VERIFIED.
 * - Las transiciones de verificación siguen la FSM de VerificationStatus.
 *
 * Patrón: idéntico a TrustProfile en trust-risk BC.
 */
const { AggregateRoot }      = require('./AggregateRoot');
const { ActorRole }          = require('../valueObjects/ActorRole');
const { VerificationStatus } = require('../valueObjects/VerificationStatus');
const { EconomicCapacity }   = require('../valueObjects/EconomicCapacity');
const { DuplicateEconomicActorError, ActorSuspendedError } = require('../errors');

const EVENTS = Object.freeze({
  CREATED:            'EconomicActorCreated',
  VERIFICATION_STARTED: 'VerificationStarted',
  VERIFIED:           'EconomicActorVerified',
  SUSPENDED:          'EconomicActorSuspended',
  CAPACITY_UPDATED:   'EconomicCapacityUpdated',
});

class EconomicActor extends AggregateRoot {
  constructor() {
    super();
    this._id                 = null;
    this._userId             = null;
    this._role               = null;
    this._verificationStatus = VerificationStatus.UNVERIFIED;
    this._capacity           = EconomicCapacity.empty();
    this._createdAt          = null;
    this._updatedAt          = null;
  }

  // ── Getters ──────────────────────────────────────────────────────────────
  get id()                 { return this._id; }
  get userId()             { return this._userId; }
  get role()               { return this._role; }
  get verificationStatus() { return this._verificationStatus; }
  get capacity()           { return this._capacity; }
  get isOperational() {
    return ['VERIFIED','UNVERIFIED','PENDING'].includes(this._verificationStatus.value);
  }

  // ── Factory: crear nuevo actor ───────────────────────────────────────────
  static create({ actorId, userId, role, occurredAt }) {
    if (!actorId) throw new Error('actorId requerido');
    if (!userId)  throw new Error('userId requerido');
    const actorRole = role instanceof ActorRole ? role : ActorRole.from(role);
    const actor = new EconomicActor();
    actor._recordEvent({
      type:        EVENTS.CREATED,
      aggregateId: actorId,
      userId,
      role:        actorRole.value,
      occurredAt:  occurredAt || new Date().toISOString(),
    });
    return actor;
  }

  // ── Factory: reconstruir desde Event Store ───────────────────────────────
  static rehydrate(events) {
    const actor = new EconomicActor();
    actor._rehydrate(events);
    return actor;
  }

  // ── Commands ─────────────────────────────────────────────────────────────

  startVerification({ occurredAt } = {}) {
    this._assertOperational();
    const next = this._verificationStatus.transitionTo('PENDING');
    this._recordEvent({
      type:        EVENTS.VERIFICATION_STARTED,
      aggregateId: this._id,
      fromStatus:  this._verificationStatus.value,
      toStatus:    next.value,
      occurredAt:  occurredAt || new Date().toISOString(),
    });
  }

  verify({ verifiedBy, occurredAt } = {}) {
    this._assertOperational();
    const next = this._verificationStatus.transitionTo('VERIFIED');
    this._recordEvent({
      type:        EVENTS.VERIFIED,
      aggregateId: this._id,
      fromStatus:  this._verificationStatus.value,
      toStatus:    next.value,
      verifiedBy:  verifiedBy || 'system',
      occurredAt:  occurredAt || new Date().toISOString(),
    });
  }

  suspend({ reason, occurredAt } = {}) {
    const next = this._verificationStatus.transitionTo('SUSPENDED');
    this._recordEvent({
      type:        EVENTS.SUSPENDED,
      aggregateId: this._id,
      fromStatus:  this._verificationStatus.value,
      toStatus:    next.value,
      reason:      reason || 'administrative',
      occurredAt:  occurredAt || new Date().toISOString(),
    });
  }

  updateCapacity({ rubroIds, zonaIds, maxConcurrentJobs, monthlyCapacityARS, occurredAt } = {}) {
    if (this._verificationStatus.value === 'SUSPENDED')
      throw new ActorSuspendedError(this._id);
    const capacity = new EconomicCapacity({ rubroIds, zonaIds, maxConcurrentJobs, monthlyCapacityARS });
    this._recordEvent({
      type:        EVENTS.CAPACITY_UPDATED,
      aggregateId: this._id,
      capacity:    capacity.toJSON(),
      occurredAt:  occurredAt || new Date().toISOString(),
    });
  }

  // ── Apply (reconstrucción de estado) ─────────────────────────────────────
  _applyEvent(event) {
    switch (event.type) {
      case EVENTS.CREATED:
        this._id        = event.aggregateId;
        this._userId    = event.userId;
        this._role      = ActorRole.from(event.role);
        this._verificationStatus = VerificationStatus.UNVERIFIED;
        this._capacity  = EconomicCapacity.empty();
        this._createdAt = event.occurredAt;
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.VERIFICATION_STARTED:
      case EVENTS.VERIFIED:
      case EVENTS.SUSPENDED:
        this._verificationStatus = new VerificationStatus(event.toStatus);
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.CAPACITY_UPDATED:
        this._capacity  = new EconomicCapacity(event.capacity);
        this._updatedAt = event.occurredAt;
        break;
    }
  }

  _assertOperational() {
    if (!this.isOperational)
      throw new ActorSuspendedError(this._id);
  }
}

module.exports = { EconomicActor, EVENTS };
