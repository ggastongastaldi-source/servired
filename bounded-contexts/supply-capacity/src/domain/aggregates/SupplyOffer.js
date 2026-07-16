'use strict';
/**
 * SupplyOffer — Agregado central del BC Supply & Capacity.
 *
 * Un actor económico verificado (MANUFACTURER, MERCHANT, WORKER)
 * declara capacidad productiva disponible para el ecosistema.
 *
 * Esto NO es una publicación de contenido.
 * Es un hecho económico verificable: quién, qué, cuánto, dónde, en qué condiciones.
 *
 * Invariantes:
 * - Solo se puede activar/pausar/retirar si el estado lo permite (FSM).
 * - La capacidad no puede reservarse si la oferta no está ACTIVE.
 * - El actor emisor (actorId) no cambia nunca.
 */
const { AggregateRoot }     = require('./AggregateRoot');
const { OfferStatus }       = require('../valueObjects/OfferStatus');
const { ProductionCapacity } = require('../valueObjects/ProductionCapacity');
const { CommercialTerms }   = require('../valueObjects/CommercialTerms');
const { OfferNotActiveError } = require('../errors');
const crypto = require('crypto');

const EVENTS = Object.freeze({
  CREATED:          'SupplyOfferCreated',
  ACTIVATED:        'SupplyOfferActivated',
  PAUSED:           'SupplyOfferPaused',
  WITHDRAWN:        'SupplyOfferWithdrawn',
  CAPACITY_RESERVED: 'SupplyCapacityReserved',
  EXHAUSTED:        'SupplyOfferExhausted',
  TERMS_UPDATED:    'CommercialTermsUpdated',
});

class SupplyOffer extends AggregateRoot {
  constructor() {
    super();
    this._id       = null;
    this._actorId  = null;
    this._rubroId  = null;
    this._zonaIds  = [];
    this._status   = OfferStatus.DRAFT;
    this._capacity = null;
    this._terms    = null;
    this._createdAt = null;
    this._updatedAt = null;
  }

  get id()       { return this._id; }
  get actorId()  { return this._actorId; }
  get rubroId()  { return this._rubroId; }
  get zonaIds()  { return this._zonaIds; }
  get status()   { return this._status; }
  get capacity() { return this._capacity; }
  get terms()    { return this._terms; }

  static create({ offerId, actorId, rubroId, zonaIds, capacity, terms, occurredAt }) {
    if (!actorId) throw new Error('actorId requerido');
    if (!rubroId) throw new Error('rubroId requerido');
    if (!zonaIds?.length) throw new Error('zonaIds requerido (al menos una zona)');
    const cap   = capacity instanceof ProductionCapacity ? capacity : new ProductionCapacity(capacity);
    const trms  = terms instanceof CommercialTerms ? terms : new CommercialTerms(terms);
    const id    = offerId || crypto.randomUUID();
    const offer = new SupplyOffer();
    offer._recordEvent({
      type: EVENTS.CREATED, aggregateId: id,
      actorId, rubroId, zonaIds: [...zonaIds],
      capacity: cap.toJSON(), terms: trms.toJSON(),
      occurredAt: occurredAt || new Date().toISOString(),
    });
    return offer;
  }

  static rehydrate(events) {
    const offer = new SupplyOffer();
    offer._rehydrate(events);
    return offer;
  }

  activate({ occurredAt } = {}) {
    const next = this._status.transitionTo('ACTIVE');
    this._recordEvent({ type: EVENTS.ACTIVATED, aggregateId: this._id,
      fromStatus: this._status.value, toStatus: next.value,
      occurredAt: occurredAt || new Date().toISOString() });
  }

  pause({ reason, occurredAt } = {}) {
    const next = this._status.transitionTo('PAUSED');
    this._recordEvent({ type: EVENTS.PAUSED, aggregateId: this._id,
      fromStatus: this._status.value, toStatus: next.value,
      reason: reason || 'manual', occurredAt: occurredAt || new Date().toISOString() });
  }

  withdraw({ reason, occurredAt } = {}) {
    const next = this._status.transitionTo('WITHDRAWN');
    this._recordEvent({ type: EVENTS.WITHDRAWN, aggregateId: this._id,
      fromStatus: this._status.value, toStatus: next.value,
      reason: reason || 'manual', occurredAt: occurredAt || new Date().toISOString() });
  }

  reserveCapacity({ units, requestedBy, occurredAt } = {}) {
    if (this._status.value !== 'ACTIVE') throw new OfferNotActiveError(this._id, this._status.value);
    const updated = this._capacity.reserve(units);
    this._recordEvent({ type: EVENTS.CAPACITY_RESERVED, aggregateId: this._id,
      units, requestedBy, remainingUnits: updated.availableUnits,
      occurredAt: occurredAt || new Date().toISOString() });
    if (updated.isExhausted()) {
      this._recordEvent({ type: EVENTS.EXHAUSTED, aggregateId: this._id,
        fromStatus: 'ACTIVE', toStatus: 'EXHAUSTED',
        occurredAt: occurredAt || new Date().toISOString() });
    }
  }

  updateTerms({ terms, occurredAt } = {}) {
    if (this._status.value === 'WITHDRAWN') throw new Error('No se pueden actualizar términos de oferta retirada');
    const trms = terms instanceof CommercialTerms ? terms : new CommercialTerms(terms);
    this._recordEvent({ type: EVENTS.TERMS_UPDATED, aggregateId: this._id,
      terms: trms.toJSON(), occurredAt: occurredAt || new Date().toISOString() });
  }

  _applyEvent(event) {
    switch (event.type) {
      case EVENTS.CREATED:
        this._id       = event.aggregateId;
        this._actorId  = event.actorId;
        this._rubroId  = event.rubroId;
        this._zonaIds  = event.zonaIds;
        this._status   = OfferStatus.DRAFT;
        this._capacity = new ProductionCapacity(event.capacity);
        this._terms    = new CommercialTerms(event.terms);
        this._createdAt = event.occurredAt;
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.ACTIVATED:
      case EVENTS.PAUSED:
      case EVENTS.WITHDRAWN:
        this._status  = new OfferStatus(event.toStatus);
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.EXHAUSTED:
        this._status  = new OfferStatus('EXHAUSTED');
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.CAPACITY_RESERVED:
        this._capacity = new ProductionCapacity({
          ...this._capacity.toJSON(),
          availableUnits: event.remainingUnits,
        });
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.TERMS_UPDATED:
        this._terms   = new CommercialTerms(event.terms);
        this._updatedAt = event.occurredAt;
        break;
    }
  }
}

module.exports = { SupplyOffer, EVENTS };
