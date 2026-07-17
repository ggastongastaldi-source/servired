'use strict';

/**
 * ProspectActor — Agregado del candidato a Actor Económico.
 *
 * Representa a una empresa, comercio o profesional en proceso
 * de incorporación al ecosistema ServiRed.
 *
 * DIFERENCIA CRÍTICA con EconomicActor:
 * - EconomicActor: participante YA DENTRO del ecosistema (verificado, opera)
 * - ProspectActor: candidato AÚN FUERA, en proceso de incorporación
 *
 * Cuando alcanza ACTIVATED emite ProspectActorActivated (integration event).
 * Ese evento dispara RegisterEconomicActor en el mismo BC,
 * convirtiendo el prospect en un EconomicActor real.
 *
 * Doctrina de Expansión Territorial — Artículo 7, Fases 2–5.
 * ADR-009.
 */
const { AggregateRoot }  = require('./AggregateRoot');
const { ProspectStatus } = require('../valueObjects/ProspectStatus');
const crypto = require('crypto');

const EVENTS = Object.freeze({
  DISCOVERED:  'ProspectActorDiscovered',
  CONTACTED:   'ProspectActorContacted',
  EDUCATED:    'ProspectActorEducated',
  ACTIVATED:   'ProspectActorActivated',    // integration event → RegisterEconomicActor
  CONTACT_LOST: 'ProspectContactLost',      // retrocede a DISCOVERED
});

class ProspectActor extends AggregateRoot {
  constructor() {
    super();
    this._id           = null;
    this._territoryId  = null;
    this._businessName = null;
    this._rubro        = null;
    this._contactInfo  = null;
    this._cetId        = null;
    this._status       = null;
    this._interactions = [];
    this._activatedAt  = null;
    this._createdAt    = null;
    this._updatedAt    = null;
  }

  // ── Getters ──────────────────────────────────────────────────────────────
  get id()           { return this._id; }
  get territoryId()  { return this._territoryId; }
  get businessName() { return this._businessName; }
  get rubro()        { return this._rubro; }
  get status()       { return this._status; }
  get cetId()        { return this._cetId; }
  get interactions() { return [...this._interactions]; }
  get isActivated()  { return this._status?.isActivated ?? false; }

  // ── Factory: descubrir nuevo candidato ──────────────────────────────────
  static discover({ prospectId, territoryId, businessName, rubro, contactInfo, cetId, occurredAt }) {
    if (!territoryId)  throw new Error('territoryId requerido');
    if (!businessName) throw new Error('businessName requerido');
    const id = prospectId || crypto.randomUUID();
    const prospect = new ProspectActor();
    prospect._recordEvent({
      type:         EVENTS.DISCOVERED,
      aggregateId:  id,
      territoryId,
      businessName,
      rubro:        rubro || 'SIN_CLASIFICAR',
      contactInfo:  contactInfo || {},
      cetId:        cetId || null,
      occurredAt:   occurredAt || new Date().toISOString(),
    });
    return prospect;
  }

  static rehydrate(events) {
    const prospect = new ProspectActor();
    prospect._rehydrate(events);
    return prospect;
  }

  // ── Commands ─────────────────────────────────────────────────────────────

  registerContact({ cetId, notes = '', occurredAt } = {}) {
    this._assertNotActivated();
    const next = this._status.transitionTo('CONTACTED');
    this._recordEvent({
      type:        EVENTS.CONTACTED,
      aggregateId: this._id,
      cetId:       cetId || this._cetId,
      notes,
      fromStatus:  this._status.value,
      toStatus:    next.value,
      occurredAt:  occurredAt || new Date().toISOString(),
    });
  }

  registerEducation({ sessionType, cetId, notes = '', occurredAt } = {}) {
    this._assertNotActivated();
    const next = this._status.transitionTo('EDUCATED');
    this._recordEvent({
      type:        EVENTS.EDUCATED,
      aggregateId: this._id,
      sessionType: sessionType || 'general',
      cetId:       cetId || this._cetId,
      notes,
      fromStatus:  this._status.value,
      toStatus:    next.value,
      occurredAt:  occurredAt || new Date().toISOString(),
    });
  }

  activate({ occurredAt } = {}) {
    this._assertNotActivated();
    const next = this._status.transitionTo('ACTIVATED');
    this._recordEvent({
      type:         EVENTS.ACTIVATED,
      aggregateId:  this._id,
      territoryId:  this._territoryId,
      businessName: this._businessName,
      rubro:        this._rubro,
      contactInfo:  this._contactInfo,
      fromStatus:   this._status.value,
      toStatus:     next.value,
      occurredAt:   occurredAt || new Date().toISOString(),
      // Este evento es consumido por RegisterEconomicActor use case
    });
  }

  loseContact({ reason = '', occurredAt } = {}) {
    if (this._status?.isActivated) return; // ya activado, no retrocede
    const next = this._status.transitionTo('DISCOVERED');
    this._recordEvent({
      type:        EVENTS.CONTACT_LOST,
      aggregateId: this._id,
      reason,
      fromStatus:  this._status.value,
      toStatus:    next.value,
      occurredAt:  occurredAt || new Date().toISOString(),
    });
  }

  // ── Apply ─────────────────────────────────────────────────────────────────
  _applyEvent(event) {
    switch (event.type) {
      case EVENTS.DISCOVERED:
        this._id           = event.aggregateId;
        this._territoryId  = event.territoryId;
        this._businessName = event.businessName;
        this._rubro        = event.rubro;
        this._contactInfo  = event.contactInfo;
        this._cetId        = event.cetId;
        this._status       = ProspectStatus.INITIAL;
        this._createdAt    = event.occurredAt;
        this._updatedAt    = event.occurredAt;
        break;
      case EVENTS.CONTACTED:
        this._status  = new ProspectStatus(event.toStatus);
        this._cetId   = event.cetId || this._cetId;
        this._interactions.push({ type: 'CONTACT', notes: event.notes, at: event.occurredAt });
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.EDUCATED:
        this._status  = new ProspectStatus(event.toStatus);
        this._interactions.push({ type: 'EDUCATION', sessionType: event.sessionType, notes: event.notes, at: event.occurredAt });
        this._updatedAt = event.occurredAt;
        break;
      case EVENTS.ACTIVATED:
        this._status      = new ProspectStatus(event.toStatus);
        this._activatedAt = event.occurredAt;
        this._updatedAt   = event.occurredAt;
        break;
      case EVENTS.CONTACT_LOST:
        this._status    = new ProspectStatus(event.toStatus);
        this._updatedAt = event.occurredAt;
        break;
    }
  }

  _assertNotActivated() {
    if (this._status?.isActivated)
      throw new Error(`ProspectActor ${this._id} ya está ACTIVATED — no acepta más transiciones`);
  }
}

module.exports = { ProspectActor, PROSPECT_EVENTS: EVENTS };
