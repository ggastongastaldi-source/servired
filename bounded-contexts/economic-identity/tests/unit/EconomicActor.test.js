'use strict';
const { EconomicActor } = require('../../src/domain/aggregates/EconomicActor');
const { EconomicCapacity } = require('../../src/domain/valueObjects/EconomicCapacity');

const BASE = { actorId: 'actor-001', userId: 'user-001', role: 'WORKER' };

describe('EconomicActor', () => {
  test('create() emite EconomicActorCreated', () => {
    const actor = EconomicActor.create(BASE);
    const events = actor.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('EconomicActorCreated');
    expect(actor.id).toBe('actor-001');
    expect(actor.role.value).toBe('WORKER');
    expect(actor.verificationStatus.value).toBe('UNVERIFIED');
  });

  test('startVerification() → PENDING', () => {
    const actor = EconomicActor.create(BASE);
    actor.pullDomainEvents();
    actor.startVerification();
    const events = actor.pullDomainEvents();
    expect(events[0].type).toBe('VerificationStarted');
    expect(actor.verificationStatus.value).toBe('PENDING');
  });

  test('verify() → VERIFIED', () => {
    const actor = EconomicActor.create(BASE);
    actor.pullDomainEvents();
    actor.startVerification();
    actor.verify({ verifiedBy: 'admin' });
    actor.pullDomainEvents();
    expect(actor.verificationStatus.value).toBe('VERIFIED');
  });

  test('updateCapacity() actualiza capacidad', () => {
    const actor = EconomicActor.create(BASE);
    actor.pullDomainEvents();
    actor.updateCapacity({ rubroIds: ['plomeria'], zonaIds: ['la-matanza'], maxConcurrentJobs: 3, monthlyCapacityARS: 500000 });
    const events = actor.pullDomainEvents();
    expect(events[0].type).toBe('EconomicCapacityUpdated');
    expect(actor.capacity.coversRubro('plomeria')).toBe(true);
    expect(actor.capacity.coversZone('la-matanza')).toBe(true);
  });

  test('rehydrate() reconstruye estado desde eventos', () => {
    const original = EconomicActor.create(BASE);
    original.startVerification();
    original.verify({ verifiedBy: 'admin' });
    const events = original.pullDomainEvents();
    const rebuilt = EconomicActor.rehydrate(events);
    expect(rebuilt.id).toBe('actor-001');
    expect(rebuilt.verificationStatus.value).toBe('VERIFIED');
    expect(rebuilt.version).toBe(3);
  });

  test('suspend() impide updateCapacity', () => {
    const actor = EconomicActor.create(BASE);
    actor.startVerification();
    actor.verify({});
    actor.suspend({ reason: 'fraude' });
    actor.pullDomainEvents();
    expect(() => actor.updateCapacity({ rubroIds: ['X'], zonaIds: ['Y'] }))
      .toThrow('suspendido');
  });

  test('ActorRole rechaza valor inválido', () => {
    expect(() => EconomicActor.create({ ...BASE, role: 'HACKER' }))
      .toThrow('ActorRole inválido');
  });
});
