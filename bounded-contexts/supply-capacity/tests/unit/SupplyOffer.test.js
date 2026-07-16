'use strict';
const { SupplyOffer } = require('../../src/domain/aggregates/SupplyOffer');

const BASE = {
  actorId: 'actor-001',
  rubroId: 'electricidad',
  zonaIds: ['la-matanza', 'lanus'],
  capacity: { totalUnits: 100, availableUnits: 100, unitLabel: 'trabajo', periodDays: 30 },
  terms:    { priceARS: 15000, minOrderUnits: 1, deliveryDays: 2 },
};

describe('SupplyOffer', () => {
  test('create() emite SupplyOfferCreated en estado DRAFT', () => {
    const offer = SupplyOffer.create(BASE);
    const events = offer.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('SupplyOfferCreated');
    expect(offer.status.value).toBe('DRAFT');
    expect(offer.rubroId).toBe('electricidad');
  });

  test('activate() → ACTIVE', () => {
    const offer = SupplyOffer.create(BASE);
    offer.pullDomainEvents();
    offer.activate();
    expect(offer.status.value).toBe('ACTIVE');
    const events = offer.pullDomainEvents();
    expect(events[0].type).toBe('SupplyOfferActivated');
  });

  test('reserveCapacity() descuenta unidades', () => {
    const offer = SupplyOffer.create(BASE);
    offer.activate();
    offer.pullDomainEvents();
    offer.reserveCapacity({ units: 30, requestedBy: 'commerce-001' });
    expect(offer.capacity.availableUnits).toBe(70);
  });

  test('reserveCapacity() en oferta no ACTIVE lanza error', () => {
    const offer = SupplyOffer.create(BASE);
    offer.pullDomainEvents();
    expect(() => offer.reserveCapacity({ units: 1 })).toThrow('no está ACTIVE');
  });

  test('reserveCapacity() que agota → estado EXHAUSTED', () => {
    const offer = SupplyOffer.create({ ...BASE, capacity: { totalUnits: 2, availableUnits: 2, unitLabel: 'u', periodDays: 30 } });
    offer.activate();
    offer.pullDomainEvents();
    offer.reserveCapacity({ units: 2 });
    expect(offer.status.value).toBe('EXHAUSTED');
    const events = offer.pullDomainEvents();
    expect(events.map(e => e.type)).toContain('SupplyOfferExhausted');
  });

  test('rehydrate() reconstruye estado desde eventos', () => {
    const original = SupplyOffer.create(BASE);
    original.activate();
    original.reserveCapacity({ units: 10, requestedBy: 'x' });
    const events = original.pullDomainEvents();
    const rebuilt = SupplyOffer.rehydrate(events);
    expect(rebuilt.status.value).toBe('ACTIVE');
    expect(rebuilt.capacity.availableUnits).toBe(90);
    expect(rebuilt.version).toBe(3);
  });

  test('withdraw() impide updateTerms', () => {
    const offer = SupplyOffer.create(BASE);
    offer.activate();
    offer.withdraw();
    offer.pullDomainEvents();
    expect(() => offer.updateTerms({ terms: { priceARS: 999, minOrderUnits: 1, deliveryDays: 1 } }))
      .toThrow('retirada');
  });

  test('create() sin zonaIds lanza error', () => {
    expect(() => SupplyOffer.create({ ...BASE, zonaIds: [] })).toThrow('zonaIds requerido');
  });
});
