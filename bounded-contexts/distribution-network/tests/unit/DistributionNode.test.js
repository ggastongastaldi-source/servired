'use strict';
const { DistributionNode } = require('../../src/domain/aggregates/DistributionNode');

const BASE = {
  usuarioId: 'user-001',
  actorId:   'actor-001',
  coverage:  { zonaIds: ['la-matanza'], rubroIds: ['electricidad'], radiusKm: 5 },
  capacity:  { maxDailyOrders: 10, currentLoad: 0, storageM3: 20 },
};

describe('DistributionNode', () => {
  test('create() emite DistributionNodeCreated en estado INACTIVE', () => {
    const node = DistributionNode.create(BASE);
    const events = node.pullDomainEvents();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('DistributionNodeCreated');
    expect(node.status.value).toBe('INACTIVE');
  });

  test('activate() → ACTIVE', () => {
    const node = DistributionNode.create(BASE);
    node.pullDomainEvents();
    node.activate();
    expect(node.status.value).toBe('ACTIVE');
  });

  test('addLoad() incrementa carga', () => {
    const node = DistributionNode.create(BASE);
    node.activate();
    node.pullDomainEvents();
    node.addLoad({ units: 3 });
    expect(node.capacity.currentLoad).toBe(3);
    expect(node.capacity.availableSlots).toBe(7);
  });

  test('addLoad() en nodo INACTIVE lanza NodeNotActiveError', () => {
    const node = DistributionNode.create(BASE);
    node.pullDomainEvents();
    expect(() => node.addLoad({ units: 1 })).toThrow('no está ACTIVE');
  });

  test('addLoad() que satura → estado SATURATED', () => {
    const node = DistributionNode.create({ ...BASE, capacity: { maxDailyOrders: 2, currentLoad: 0 } });
    node.activate();
    node.pullDomainEvents();
    node.addLoad({ units: 2 });
    expect(node.status.value).toBe('SATURATED');
  });

  test('releaseLoad() desde SATURATED → vuelve a ACTIVE', () => {
    const node = DistributionNode.create({ ...BASE, capacity: { maxDailyOrders: 2, currentLoad: 0 } });
    node.activate();
    node.addLoad({ units: 2 });
    node.pullDomainEvents();
    node.releaseLoad({ units: 1 });
    expect(node.status.value).toBe('ACTIVE');
  });

  test('coverage.canService() verifica zona y rubro', () => {
    const node = DistributionNode.create(BASE);
    expect(node.coverage.canService('la-matanza', 'electricidad')).toBe(true);
    expect(node.coverage.canService('la-matanza', 'plomeria')).toBe(false);
  });

  test('rehydrate() reconstruye estado desde eventos', () => {
    const original = DistributionNode.create(BASE);
    original.activate();
    original.addLoad({ units: 4 });
    const events = original.pullDomainEvents();
    const rebuilt = DistributionNode.rehydrate(events);
    expect(rebuilt.status.value).toBe('ACTIVE');
    expect(rebuilt.capacity.currentLoad).toBe(4);
    expect(rebuilt.version).toBe(3);
  });

  test('updateCoverage() en nodo OFFLINE lanza error', () => {
    const node = DistributionNode.create(BASE);
    node.activate();
    node.deactivate();
    node.pullDomainEvents();
    expect(() => node.updateCoverage({ coverage: { zonaIds: ['lanus'], rubroIds: [], radiusKm: 0 } }))
      .toThrow('OFFLINE');
  });
});
