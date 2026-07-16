'use strict';
/**
 * DistributionNode — Agregado central del BC Distribution Network.
 *
 * Responsabilidad: representar un activo de infraestructura territorial.
 * Un comercio, depósito o punto de distribución que conecta
 * SupplyOffers con demanda territorial.
 *
 * NO es un perfil de usuario. NO tiene datos de UI.
 * Es un nodo económico en la red de distribución del territorio.
 *
 * Relación con BusinessProfile: coexisten por usuarioId.
 * BusinessProfile = onboarding/UI. DistributionNode = infraestructura territorial.
 *
 * Invariantes:
 * - Solo acepta carga si está ACTIVE y no está saturado.
 * - La cobertura territorial solo se actualiza si no está OFFLINE.
 * - El usuarioId no cambia nunca.
 */
const { AggregateRoot }       = require('./AggregateRoot');
const { NodeStatus }          = require('../valueObjects/NodeStatus');
const { TerritorialCoverage } = require('../valueObjects/TerritorialCoverage');
const { LogisticCapacity }    = require('../valueObjects/LogisticCapacity');
const { NodeNotActiveError, NodeSaturatedError } = require('../errors');
const crypto = require('crypto');

const EVENTS = Object.freeze({
  CREATED:           'DistributionNodeCreated',
  ACTIVATED:         'DistributionNodeActivated',
  DEACTIVATED:       'DistributionNodeDeactivated',
  SATURATED:         'DistributionNodeSaturated',
  LOAD_ADDED:        'NodeLoadAdded',
  LOAD_RELEASED:     'NodeLoadReleased',
  COVERAGE_UPDATED:  'TerritorialCoverageUpdated',
  CAPACITY_UPDATED:  'LogisticCapacityUpdated',
});

class DistributionNode extends AggregateRoot {
  constructor() {
    super();
    this._id        = null;
    this._usuarioId = null;
    this._actorId   = null;
    this._status    = NodeStatus.INACTIVE;
    this._coverage  = TerritorialCoverage.empty();
    this._capacity  = null;
    this._createdAt = null;
    this._updatedAt = null;
  }

  get id()        { return this._id; }
  get usuarioId() { return this._usuarioId; }
  get actorId()   { return this._actorId; }
  get status()    { return this._status; }
  get coverage()  { return this._coverage; }
  get capacity()  { return this._capacity; }

  static create({ nodeId, usuarioId, actorId, coverage, capacity, occurredAt }) {
    if (!usuarioId) throw new Error('usuarioId requerido');
    if (!actorId)   throw new Error('actorId requerido');
    const cov = coverage instanceof TerritorialCoverage ? coverage : new TerritorialCoverage(coverage || {});
    const cap = capacity instanceof LogisticCapacity    ? capacity : new LogisticCapacity(capacity || { maxDailyOrders: 10 });
    const id  = nodeId || crypto.randomUUID();
    const node = new DistributionNode();
    node._recordEvent({
      type: EVENTS.CREATED, aggregateId: id,
      usuarioId, actorId,
      coverage: cov.toJSON(), capacity: cap.toJSON(),
      occurredAt: occurredAt || new Date().toISOString(),
    });
    return node;
  }

  static rehydrate(events) {
    const node = new DistributionNode();
    node._rehydrate(events);
    return node;
  }

  activate({ occurredAt } = {}) {
    const next = this._status.transitionTo('ACTIVE');
    this._recordEvent({ type: EVENTS.ACTIVATED, aggregateId: this._id,
      fromStatus: this._status.value, toStatus: next.value,
      occurredAt: occurredAt || new Date().toISOString() });
  }

  deactivate({ reason, occurredAt } = {}) {
    const next = this._status.transitionTo('OFFLINE');
    this._recordEvent({ type: EVENTS.DEACTIVATED, aggregateId: this._id,
      fromStatus: this._status.value, toStatus: next.value,
      reason: reason || 'manual', occurredAt: occurredAt || new Date().toISOString() });
  }

  addLoad({ units = 1, sourceOfferId, occurredAt } = {}) {
    if (this._status.value !== 'ACTIVE') throw new NodeNotActiveError(this._id, this._status.value);
    if (this._capacity.isSaturated())    throw new NodeSaturatedError(this._id);
    const updated = this._capacity.addLoad(units);
    this._recordEvent({ type: EVENTS.LOAD_ADDED, aggregateId: this._id,
      units, sourceOfferId, newLoad: updated.currentLoad,
      occurredAt: occurredAt || new Date().toISOString() });
    if (updated.isSaturated()) {
      this._recordEvent({ type: EVENTS.SATURATED, aggregateId: this._id,
        fromStatus: 'ACTIVE', toStatus: 'SATURATED',
        occurredAt: occurredAt || new Date().toISOString() });
    }
  }

  releaseLoad({ units = 1, occurredAt } = {}) {
    const updated = this._capacity.releaseLoad(units);
    const wasSaturated = this._status.value === 'SATURATED';
    this._recordEvent({ type: EVENTS.LOAD_RELEASED, aggregateId: this._id,
      units, newLoad: updated.currentLoad,
      occurredAt: occurredAt || new Date().toISOString() });
    if (wasSaturated) {
      this._recordEvent({ type: EVENTS.ACTIVATED, aggregateId: this._id,
        fromStatus: 'SATURATED', toStatus: 'ACTIVE',
        occurredAt: occurredAt || new Date().toISOString() });
    }
  }

  updateCoverage({ coverage, occurredAt } = {}) {
    if (this._status.value === 'OFFLINE') throw new Error('No se puede actualizar cobertura de un nodo OFFLINE');
    const cov = coverage instanceof TerritorialCoverage ? coverage : new TerritorialCoverage(coverage);
    this._recordEvent({ type: EVENTS.COVERAGE_UPDATED, aggregateId: this._id,
      coverage: cov.toJSON(), occurredAt: occurredAt || new Date().toISOString() });
  }

  _applyEvent(event) {
    switch (event.type) {
      case EVENTS.CREATED:
        this._id        = event.aggregateId;
        this._usuarioId = event.usuarioId;
        this._actorId   = event.actorId;
        this._status    = NodeStatus.INACTIVE;
        this._coverage  = new TerritorialCoverage(event.coverage);
        this._capacity  = new LogisticCapacity(event.capacity);
        this._createdAt = event.occurredAt;
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.ACTIVATED:
        this._status  = NodeStatus.ACTIVE;
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.DEACTIVATED:
        this._status  = new NodeStatus('OFFLINE');
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.SATURATED:
        this._status  = new NodeStatus('SATURATED');
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.LOAD_ADDED:
        this._capacity = new LogisticCapacity({ ...this._capacity.toJSON(), currentLoad: event.newLoad });
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.LOAD_RELEASED:
        this._capacity = new LogisticCapacity({ ...this._capacity.toJSON(), currentLoad: event.newLoad });
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.COVERAGE_UPDATED:
        this._coverage = new TerritorialCoverage(event.coverage);
        this._updatedAt = event.occurredAt;
        break;
    }
  }
}

module.exports = { DistributionNode, EVENTS };
