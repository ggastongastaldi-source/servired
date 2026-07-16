'use strict';
/**
 * TerritorialCycle — Agregado central del BC Cycle Orchestration.
 *
 * Responsabilidad única: cerrar ciclos económicos completos.
 * Fabricante → Comercio → Trabajador → Cliente.
 *
 * NO conoce los internos de EconomicActor, SupplyOffer,
 * DistributionNode ni TerritorialSnapshot.
 * Coordina por IDs opacos y emite eventos que los otros BCs
 * consumen via SINAPSIS.
 *
 * Invariantes:
 * - Un ciclo terminal (COMPLETED/CANCELLED) no acepta más transiciones.
 * - CycleValue solo se registra al completar — nunca antes.
 * - Los participantes se enriquecen progresivamente (offerId → nodeId → workerId).
 *
 * Eventos emitidos (consumidos por SINAPSIS → otros BCs):
 *   TerritorialCycleStarted    → TerritorialSnapshot registra señal
 *   OfferReserved              → supply-capacity descuenta capacidad
 *   DistributionAssigned       → distribution-network agrega carga
 *   WorkerAssigned             → economic-identity actualiza ocupación
 *   TerritorialCycleCompleted  → territorial-intelligence registra ciclo
 *   TerritorialCycleCancelled  → todos liberan recursos
 */
const { AggregateRoot }     = require('./AggregateRoot');
const { CycleStatus }       = require('../valueObjects/CycleStatus');
const { CycleParticipants } = require('../valueObjects/CycleParticipants');
const { CycleValue }        = require('../valueObjects/CycleValue');
const { CycleAlreadyTerminalError } = require('../errors');
const crypto = require('crypto');

const EVENTS = Object.freeze({
  STARTED:               'TerritorialCycleStarted',
  OFFER_RESERVED:        'OfferReserved',
  DISTRIBUTION_ASSIGNED: 'DistributionAssigned',
  WORKER_ASSIGNED:       'WorkerAssigned',
  IN_PROGRESS:           'CycleInProgress',
  COMPLETED:             'TerritorialCycleCompleted',
  CANCELLED:             'TerritorialCycleCancelled',
});

class TerritorialCycle extends AggregateRoot {
  constructor() {
    super();
    this._id           = null;
    this._zonaId       = null;
    this._rubroId      = null;
    this._status       = null;
    this._participants = null;
    this._value        = null;
    this._cancelReason = null;
    this._startedAt    = null;
    this._completedAt  = null;
  }

  get id()           { return this._id; }
  get zonaId()       { return this._zonaId; }
  get rubroId()      { return this._rubroId; }
  get status()       { return this._status; }
  get participants() { return this._participants; }
  get value()        { return this._value; }
  get isTerminal()   { return this._status?.isTerminal ?? false; }

  static start({ cycleId, zonaId, rubroId, actorId, clientId, occurredAt }) {
    if (!zonaId)   throw new Error('zonaId requerido');
    if (!rubroId)  throw new Error('rubroId requerido');
    if (!actorId)  throw new Error('actorId requerido');
    if (!clientId) throw new Error('clientId requerido');
    const id           = cycleId || crypto.randomUUID();
    const participants = new CycleParticipants({ actorId, clientId });
    const cycle        = new TerritorialCycle();
    cycle._recordEvent({
      type: EVENTS.STARTED, aggregateId: id,
      zonaId, rubroId,
      participants: participants.toJSON(),
      occurredAt: occurredAt || new Date().toISOString(),
    });
    return cycle;
  }

  static rehydrate(events) {
    const cycle = new TerritorialCycle();
    cycle._rehydrate(events);
    return cycle;
  }

  reserveOffer({ offerId, unitsReserved = 1, occurredAt } = {}) {
    this._assertNotTerminal();
    const next = this._status.transitionTo('OFFER_RESERVED');
    this._recordEvent({
      type: EVENTS.OFFER_RESERVED, aggregateId: this._id,
      offerId, unitsReserved,
      fromStatus: this._status.value, toStatus: next.value,
      occurredAt: occurredAt || new Date().toISOString(),
    });
  }

  assignDistribution({ nodeId, occurredAt } = {}) {
    this._assertNotTerminal();
    const next = this._status.transitionTo('DISTRIBUTION_ASSIGNED');
    this._recordEvent({
      type: EVENTS.DISTRIBUTION_ASSIGNED, aggregateId: this._id,
      nodeId,
      fromStatus: this._status.value, toStatus: next.value,
      occurredAt: occurredAt || new Date().toISOString(),
    });
  }

  assignWorker({ workerId, occurredAt } = {}) {
    this._assertNotTerminal();
    const next = this._status.transitionTo('WORKER_ASSIGNED');
    this._recordEvent({
      type: EVENTS.WORKER_ASSIGNED, aggregateId: this._id,
      workerId,
      fromStatus: this._status.value, toStatus: next.value,
      occurredAt: occurredAt || new Date().toISOString(),
    });
  }

  startExecution({ occurredAt } = {}) {
    this._assertNotTerminal();
    const next = this._status.transitionTo('IN_PROGRESS');
    this._recordEvent({
      type: EVENTS.IN_PROGRESS, aggregateId: this._id,
      fromStatus: this._status.value, toStatus: next.value,
      occurredAt: occurredAt || new Date().toISOString(),
    });
  }

  complete({ grossARS, commissionARS, workerARS, occurredAt } = {}) {
    this._assertNotTerminal();
    const next  = this._status.transitionTo('COMPLETED');
    const value = new CycleValue({ grossARS, commissionARS, workerARS });
    this._recordEvent({
      type: EVENTS.COMPLETED, aggregateId: this._id,
      zonaId:       this._zonaId,
      rubroId:      this._rubroId,
      participants: this._participants.toJSON(),
      value:        value.toJSON(),
      fromStatus:   this._status.value, toStatus: next.value,
      occurredAt:   occurredAt || new Date().toISOString(),
    });
  }

  cancel({ reason, occurredAt } = {}) {
    this._assertNotTerminal();
    this._recordEvent({
      type: EVENTS.CANCELLED, aggregateId: this._id,
      reason: reason || 'manual',
      fromStatus: this._status.value, toStatus: 'CANCELLED',
      participants: this._participants?.toJSON(),
      occurredAt: occurredAt || new Date().toISOString(),
    });
  }

  _assertNotTerminal() {
    if (this._status?.isTerminal)
      throw new CycleAlreadyTerminalError(this._id, this._status.value);
  }

  _applyEvent(event) {
    switch (event.type) {
      case EVENTS.STARTED:
        this._id           = event.aggregateId;
        this._zonaId       = event.zonaId;
        this._rubroId      = event.rubroId;
        this._status       = CycleStatus.INITIATED;
        this._participants = new CycleParticipants(event.participants);
        this._startedAt    = event.occurredAt;
        break;
      case EVENTS.OFFER_RESERVED:
        this._status       = new CycleStatus(event.toStatus);
        this._participants = this._participants.withOffer(event.offerId);
        break;
      case EVENTS.DISTRIBUTION_ASSIGNED:
        this._status       = new CycleStatus(event.toStatus);
        this._participants = this._participants.withNode(event.nodeId);
        break;
      case EVENTS.WORKER_ASSIGNED:
        this._status       = new CycleStatus(event.toStatus);
        this._participants = this._participants.withWorker(event.workerId);
        break;
      case EVENTS.IN_PROGRESS:
        this._status = new CycleStatus(event.toStatus);
        break;
      case EVENTS.COMPLETED:
        this._status      = new CycleStatus(event.toStatus);
        this._value       = new CycleValue(event.value);
        this._completedAt = event.occurredAt;
        break;
      case EVENTS.CANCELLED:
        this._status       = new CycleStatus('CANCELLED');
        this._cancelReason = event.reason;
        break;
    }
  }
}

module.exports = { TerritorialCycle, EVENTS };
