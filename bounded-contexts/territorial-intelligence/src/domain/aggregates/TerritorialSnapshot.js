'use strict';
/**
 * TerritorialSnapshot — Agregado de inteligencia territorial.
 *
 * Agrega señales económicas de múltiples bounded contexts
 * (SupplyOffer, DistributionNode, Jobs) para producir
 * inteligencia colectiva sobre el estado económico de una zona.
 *
 * NO coordina operaciones. NO da órdenes a otros BCs.
 * OBSERVA eventos y ACUMULA conocimiento territorial.
 *
 * La inteligencia emerge de los datos — no es impuesta.
 *
 * Coordenadas de integración:
 *   SupplyOfferActivated   → signal SUPPLY_OFFER_ACTIVATED
 *   DistributionNodeActive → signal DISTRIBUTION_NODE_ACTIVATED
 *   JobCreated             → signal DEMAND_REGISTERED
 *   TerritorialCycle closed → signal CYCLE_COMPLETED
 */
const { AggregateRoot }  = require('./AggregateRoot');
const { ZoneHealth }     = require('../valueObjects/ZoneHealth');
const { EconomicSignal } = require('../valueObjects/EconomicSignal');
const crypto = require('crypto');

const EVENTS = Object.freeze({
  INITIALIZED:      'TerritorialSnapshotInitialized',
  SIGNAL_RECEIVED:  'EconomicSignalReceived',
  HEALTH_UPDATED:   'ZoneHealthUpdated',
  CYCLE_RECORDED:   'TerritorialCycleRecorded',
});

class TerritorialSnapshot extends AggregateRoot {
  constructor() {
    super();
    this._id             = null;
    this._zonaId         = null;
    this._rubroIds       = new Set();
    this._activeOffers   = 0;
    this._activeNodes    = 0;
    this._pendingDemand  = 0;
    this._logisticLoad   = 0;
    this._cyclesCompleted = 0;
    this._health         = null;
    this._signals        = [];   // últimas N señales (rolling window)
    this._createdAt      = null;
    this._updatedAt      = null;
  }

  get id()              { return this._id; }
  get zonaId()          { return this._zonaId; }
  get activeOffers()    { return this._activeOffers; }
  get activeNodes()     { return this._activeNodes; }
  get pendingDemand()   { return this._pendingDemand; }
  get cyclesCompleted() { return this._cyclesCompleted; }
  get health()          { return this._health; }
  get signals()         { return [...this._signals]; }

  static initialize({ snapshotId, zonaId, rubroIds = [], occurredAt }) {
    if (!zonaId) throw new Error('zonaId requerido');
    const id       = snapshotId || crypto.randomUUID();
    const snapshot = new TerritorialSnapshot();
    const initialHealth = new ZoneHealth('CRITICAL'); // sin datos = crítico
    snapshot._recordEvent({
      type: EVENTS.INITIALIZED, aggregateId: id,
      zonaId, rubroIds: [...rubroIds],
      health: initialHealth.value,
      occurredAt: occurredAt || new Date().toISOString(),
    });
    return snapshot;
  }

  static rehydrate(events) {
    const snapshot = new TerritorialSnapshot();
    snapshot._rehydrate(events);
    return snapshot;
  }

  /**
   * Recibe un impulso económico y recalcula la salud territorial.
   * Punto de integración con todos los otros BCs — via eventos SINAPSIS.
   */
  receiveSignal(signal) {
    const sig = signal instanceof EconomicSignal ? signal : new EconomicSignal(signal);
    const previousHealth = this._health?.value;

    // Calcular contadores proyectados
    const projected = this._projectCounters(sig);
    const newHealth = ZoneHealth.fromSignals(projected);

    this._recordEvent({
      type: EVENTS.SIGNAL_RECEIVED, aggregateId: this._id,
      signal: sig.toJSON(),
      counters: projected,
      occurredAt: sig.occurredAt,
    });

    if (newHealth.value !== previousHealth) {
      this._recordEvent({
        type: EVENTS.HEALTH_UPDATED, aggregateId: this._id,
        fromHealth: previousHealth,
        toHealth:   newHealth.value,
        zonaId:     this._zonaId,
        occurredAt: sig.occurredAt,
      });
    }
  }

  recordCycle({ cycleId, rubroId, actorIds = [], valueARS = 0, occurredAt } = {}) {
    this._recordEvent({
      type: EVENTS.CYCLE_RECORDED, aggregateId: this._id,
      cycleId: cycleId || crypto.randomUUID(),
      rubroId, actorIds, valueARS,
      occurredAt: occurredAt || new Date().toISOString(),
    });
  }

  _projectCounters(signal) {
    let { _activeOffers: ao, _activeNodes: an, _pendingDemand: pd, _logisticLoad: ll } = this;
    switch (signal.type) {
      case 'SUPPLY_OFFER_ACTIVATED':    ao = Math.max(0, ao + signal.magnitude); break;
      case 'SUPPLY_OFFER_WITHDRAWN':
      case 'SUPPLY_OFFER_EXHAUSTED':    ao = Math.max(0, ao - signal.magnitude); break;
      case 'DISTRIBUTION_NODE_ACTIVATED': an = Math.max(0, an + signal.magnitude); break;
      case 'DISTRIBUTION_NODE_OFFLINE':
      case 'DISTRIBUTION_NODE_SATURATED': an = Math.max(0, an - signal.magnitude); ll = Math.min(1, ll + 0.1); break;
      case 'DEMAND_REGISTERED':         pd = Math.max(0, pd + signal.magnitude); break;
      case 'CYCLE_COMPLETED':           pd = Math.max(0, pd - signal.magnitude); break;
    }
    return { activeOffers: ao, activeNodes: an, pendingDemand: pd, logisticLoad: ll };
  }

  _applyEvent(event) {
    const MAX_SIGNALS = 50;
    switch (event.type) {
      case EVENTS.INITIALIZED:
        this._id        = event.aggregateId;
        this._zonaId    = event.zonaId;
        this._rubroIds  = new Set(event.rubroIds || []);
        this._health    = new ZoneHealth(event.health);
        this._createdAt = event.occurredAt;
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.SIGNAL_RECEIVED:
        this._activeOffers  = event.counters.activeOffers;
        this._activeNodes   = event.counters.activeNodes;
        this._pendingDemand = event.counters.pendingDemand;
        this._logisticLoad  = event.counters.logisticLoad;
        this._signals = [...this._signals, event.signal].slice(-MAX_SIGNALS);
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.HEALTH_UPDATED:
        this._health    = new ZoneHealth(event.toHealth);
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.CYCLE_RECORDED:
        this._cyclesCompleted++;
        this._updatedAt = event.occurredAt;
        break;
    }
  }
}

module.exports = { TerritorialSnapshot, EVENTS };
