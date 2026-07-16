'use strict';
const { TerritorialSnapshot } = require('../../src/domain/aggregates/TerritorialSnapshot');
const { ZoneHealth }          = require('../../src/domain/valueObjects/ZoneHealth');

const BASE = { zonaId: 'la-matanza', rubroIds: ['electricidad', 'plomeria'] };

describe('TerritorialSnapshot', () => {
  test('initialize() emite TerritorialSnapshotInitialized con health CRITICAL', () => {
    const snap = TerritorialSnapshot.initialize(BASE);
    const events = snap.pullDomainEvents();
    expect(events[0].type).toBe('TerritorialSnapshotInitialized');
    expect(snap.health.value).toBe('CRITICAL');
    expect(snap.zonaId).toBe('la-matanza');
  });

  test('receiveSignal() SUPPLY_OFFER_ACTIVATED incrementa activeOffers', () => {
    const snap = TerritorialSnapshot.initialize(BASE);
    snap.pullDomainEvents();
    snap.receiveSignal({ type: 'SUPPLY_OFFER_ACTIVATED', zonaId: 'la-matanza', rubroId: 'electricidad', magnitude: 1 });
    expect(snap.activeOffers).toBe(1);
  });

  test('receiveSignal() emite HEALTH_UPDATED cuando cambia salud', () => {
    const snap = TerritorialSnapshot.initialize(BASE);
    snap.pullDomainEvents();
    // Activar oferta y nodo → zona pasa de CRITICAL a algo distinto
    snap.receiveSignal({ type: 'SUPPLY_OFFER_ACTIVATED',      zonaId: 'la-matanza', rubroId: 'electricidad', magnitude: 5 });
    snap.receiveSignal({ type: 'DISTRIBUTION_NODE_ACTIVATED', zonaId: 'la-matanza', rubroId: 'electricidad', magnitude: 2 });
    const events = snap.pullDomainEvents();
    const healthEvents = events.filter(e => e.type === 'ZoneHealthUpdated');
    expect(healthEvents.length).toBeGreaterThan(0);
  });

  test('ZoneHealth CRITICAL cuando no hay nodos ni ofertas', () => {
    const health = ZoneHealth.fromSignals({ activeOffers: 0, activeNodes: 0, pendingDemand: 5, logisticLoad: 0 });
    expect(health.value).toBe('CRITICAL');
    expect(health.requiresIntervention).toBe(true);
  });

  test('ZoneHealth BALANCED con oferta y demanda equilibradas', () => {
    const health = ZoneHealth.fromSignals({ activeOffers: 5, activeNodes: 3, pendingDemand: 5, logisticLoad: 0.5 });
    expect(health.value).toBe('BALANCED');
    expect(health.isOptimal).toBe(true);
  });

  test('ZoneHealth SURPLUS cuando hay exceso de oferta', () => {
    const health = ZoneHealth.fromSignals({ activeOffers: 20, activeNodes: 5, pendingDemand: 5, logisticLoad: 0.1 });
    expect(health.value).toBe('SURPLUS');
  });

  test('recordCycle() incrementa cyclesCompleted', () => {
    const snap = TerritorialSnapshot.initialize(BASE);
    snap.pullDomainEvents();
    snap.recordCycle({ rubroId: 'electricidad', actorIds: ['a1','a2'], valueARS: 50000 });
    expect(snap.cyclesCompleted).toBe(1);
  });

  test('rehydrate() reconstruye estado desde eventos', () => {
    const original = TerritorialSnapshot.initialize(BASE);
    original.receiveSignal({ type: 'SUPPLY_OFFER_ACTIVATED', zonaId: 'la-matanza', rubroId: 'electricidad', magnitude: 3 });
    original.recordCycle({ rubroId: 'electricidad', valueARS: 30000 });
    const events = original.pullDomainEvents();
    const rebuilt = TerritorialSnapshot.rehydrate(events);
    expect(rebuilt.zonaId).toBe('la-matanza');
    expect(rebuilt.activeOffers).toBe(3);
    expect(rebuilt.cyclesCompleted).toBe(1);
  });

  test('EconomicSignal rechaza tipo inválido', () => {
    const snap = TerritorialSnapshot.initialize(BASE);
    snap.pullDomainEvents();
    expect(() => snap.receiveSignal({ type: 'EVENTO_INVENTADO', zonaId: 'la-matanza', rubroId: 'x' }))
      .toThrow('tipo inválido');
  });
});
