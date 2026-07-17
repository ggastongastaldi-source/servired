'use strict';

/**
 * TerritoryDevelopment — Agregado del ciclo de madurez territorial.
 *
 * DIFERENCIA con TerritorialSnapshot:
 * - TerritorialSnapshot: INTELIGENCIA (observa señales, calcula ZoneHealth)
 * - TerritoryDevelopment: DESARROLLO (ciclo de madurez: IDENTIFIED→SCALABLE)
 *
 * TerritoryDevelopment PRODUCE señales que TerritorialSnapshot CONSUME.
 * Cuando un territorio avanza de estado, emite señales económicas
 * que enriquecen el TerritorialSnapshot de la misma zona.
 *
 * Doctrina de Expansión Territorial — Artículo 7 (Fases 1-8) y Artículo 12.
 * ADR-009.
 */
const { AggregateRoot }  = require('./AggregateRoot');
const { TerritoryStatus } = require('../valueObjects/TerritoryStatus');
const crypto = require('crypto');

const EVENTS = Object.freeze({
  IDENTIFIED:   'TerritoryIdentified',
  MAPPED:       'TerritoryMapped',
  ACTIVATED:    'TerritoryActivated',
  CONSOLIDATED: 'TerritoryConsolidated',
  SCALABLE:     'TerritoryScalable',
  CET_ASSIGNED: 'TerritorialCETAssigned',
});

class TerritoryDevelopment extends AggregateRoot {
  constructor() {
    super();
    this._id              = null;
    this._name            = null;
    this._region          = null;
    this._country         = 'AR';
    this._status          = null;
    this._assignedCETId   = null;
    this._economicMap     = null;
    this._consolidationMetrics = null;
    this._identifiedAt    = null;
    this._activatedAt     = null;
    this._consolidatedAt  = null;
    this._updatedAt       = null;
  }

  // ── Getters ──────────────────────────────────────────────────────────────
  get id()     { return this._id; }
  get name()   { return this._name; }
  get region() { return this._region; }
  get status() { return this._status; }
  get assignedCETId() { return this._assignedCETId; }

  // ── Factory ──────────────────────────────────────────────────────────────
  static identify({ territoryId, name, region, country = 'AR', occurredAt }) {
    if (!name)   throw new Error('name requerido');
    if (!region) throw new Error('region requerido');
    const id       = territoryId || crypto.randomUUID();
    const territory = new TerritoryDevelopment();
    territory._recordEvent({
      type: EVENTS.IDENTIFIED, aggregateId: id,
      name, region, country,
      occurredAt: occurredAt || new Date().toISOString(),
    });
    return territory;
  }

  static rehydrate(events) {
    const territory = new TerritoryDevelopment();
    territory._rehydrate(events);
    return territory;
  }

  // ── Commands ─────────────────────────────────────────────────────────────

  map({ economicMap, occurredAt } = {}) {
    if (!economicMap) throw new Error('economicMap requerido');
    const next = this._status.transitionTo('MAPPED');
    this._recordEvent({
      type: EVENTS.MAPPED, aggregateId: this._id,
      economicMap,
      fromStatus: this._status.value, toStatus: next.value,
      occurredAt: occurredAt || new Date().toISOString(),
    });
  }

  assignCET({ cetId, occurredAt } = {}) {
    if (!cetId) throw new Error('cetId requerido');
    this._recordEvent({
      type: EVENTS.CET_ASSIGNED, aggregateId: this._id,
      cetId,
      occurredAt: occurredAt || new Date().toISOString(),
    });
  }

  activate({ cetId, occurredAt } = {}) {
    const next = this._status.transitionTo('ACTIVE');
    this._recordEvent({
      type: EVENTS.ACTIVATED, aggregateId: this._id,
      cetId: cetId || this._assignedCETId,
      fromStatus: this._status.value, toStatus: next.value,
      occurredAt: occurredAt || new Date().toISOString(),
    });
  }

  consolidate({ metrics, occurredAt } = {}) {
    if (!metrics) throw new Error('metrics requerido');
    const next = this._status.transitionTo('CONSOLIDATED');
    this._recordEvent({
      type: EVENTS.CONSOLIDATED, aggregateId: this._id,
      metrics,
      fromStatus: this._status.value, toStatus: next.value,
      occurredAt: occurredAt || new Date().toISOString(),
    });
  }

  markScalable({ occurredAt } = {}) {
    const next = this._status.transitionTo('SCALABLE');
    this._recordEvent({
      type: EVENTS.SCALABLE, aggregateId: this._id,
      fromStatus: this._status.value, toStatus: next.value,
      occurredAt: occurredAt || new Date().toISOString(),
    });
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  _applyEvent(event) {
    switch (event.type) {
      case EVENTS.IDENTIFIED:
        this._id           = event.aggregateId;
        this._name         = event.name;
        this._region       = event.region;
        this._country      = event.country;
        this._status       = TerritoryStatus.INITIAL;
        this._identifiedAt = event.occurredAt;
        this._updatedAt    = event.occurredAt;
        break;
      case EVENTS.MAPPED:
        this._status      = new TerritoryStatus(event.toStatus);
        this._economicMap = event.economicMap;
        this._updatedAt   = event.occurredAt;
        break;
      case EVENTS.CET_ASSIGNED:
        this._assignedCETId = event.cetId;
        this._updatedAt     = event.occurredAt;
        break;
      case EVENTS.ACTIVATED:
        this._status      = new TerritoryStatus(event.toStatus);
        this._activatedAt = event.occurredAt;
        if (event.cetId) this._assignedCETId = event.cetId;
        this._updatedAt   = event.occurredAt;
        break;
      case EVENTS.CONSOLIDATED:
        this._status               = new TerritoryStatus(event.toStatus);
        this._consolidationMetrics = event.metrics;
        this._consolidatedAt       = event.occurredAt;
        this._updatedAt            = event.occurredAt;
        break;
      case EVENTS.SCALABLE:
        this._status    = new TerritoryStatus(event.toStatus);
        this._updatedAt = event.occurredAt;
        break;
    }
  }
}

module.exports = { TerritoryDevelopment, TERRITORY_EVENTS: EVENTS };
