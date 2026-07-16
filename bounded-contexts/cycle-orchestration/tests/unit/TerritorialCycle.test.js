'use strict';
const { TerritorialCycle } = require('../../src/domain/aggregates/TerritorialCycle');
const { CycleValue }       = require('../../src/domain/valueObjects/CycleValue');

const BASE = {
  zonaId:   'la-matanza',
  rubroId:  'electricidad',
  actorId:  'actor-001',
  clientId: 'client-001',
};

describe('TerritorialCycle', () => {
  test('start() emite TerritorialCycleStarted en INITIATED', () => {
    const cycle = TerritorialCycle.start(BASE);
    const events = cycle.pullDomainEvents();
    expect(events[0].type).toBe('TerritorialCycleStarted');
    expect(cycle.status.value).toBe('INITIATED');
    expect(cycle.participants.actorId).toBe('actor-001');
  });

  test('ciclo completo: INITIATED → COMPLETED', () => {
    const cycle = TerritorialCycle.start(BASE);
    cycle.reserveOffer({ offerId: 'offer-001', unitsReserved: 1 });
    cycle.assignDistribution({ nodeId: 'node-001' });
    cycle.assignWorker({ workerId: 'worker-001' });
    cycle.startExecution();
    cycle.complete({ grossARS: 10000, commissionARS: 1200, workerARS: 8800 });
    expect(cycle.status.value).toBe('COMPLETED');
    expect(cycle.value.grossARS).toBe(10000);
    expect(cycle.participants.offerId).toBe('offer-001');
    expect(cycle.participants.nodeId).toBe('node-001');
    expect(cycle.participants.workerId).toBe('worker-001');
    expect(cycle.isTerminal).toBe(true);
  });

  test('complete() emite TerritorialCycleCompleted con participants y value', () => {
    const cycle = TerritorialCycle.start(BASE);
    cycle.reserveOffer({ offerId: 'offer-001', unitsReserved: 1 });
    cycle.assignDistribution({ nodeId: 'node-001' });
    cycle.assignWorker({ workerId: 'worker-001' });
    cycle.startExecution();
    cycle.pullDomainEvents();
    cycle.complete({ grossARS: 5000, commissionARS: 600, workerARS: 4400 });
    const events = cycle.pullDomainEvents();
    const completed = events.find(e => e.type === 'TerritorialCycleCompleted');
    expect(completed).toBeDefined();
    expect(completed.value.grossARS).toBe(5000);
    expect(completed.participants.workerId).toBe('worker-001');
  });

  test('cancel() desde cualquier estado no terminal', () => {
    const cycle = TerritorialCycle.start(BASE);
    cycle.reserveOffer({ offerId: 'offer-001', unitsReserved: 1 });
    cycle.pullDomainEvents();
    cycle.cancel({ reason: 'sin_nodo_disponible' });
    expect(cycle.status.value).toBe('CANCELLED');
    expect(cycle.isTerminal).toBe(true);
  });

  test('operación sobre ciclo COMPLETED lanza CycleAlreadyTerminalError', () => {
    const cycle = TerritorialCycle.start(BASE);
    cycle.reserveOffer({ offerId: 'o1', unitsReserved: 1 });
    cycle.assignDistribution({ nodeId: 'n1' });
    cycle.assignWorker({ workerId: 'w1' });
    cycle.startExecution();
    cycle.complete({ grossARS: 1000, commissionARS: 120, workerARS: 880 });
    expect(() => cycle.cancel({ reason: 'tarde' })).toThrow('terminal');
  });

  test('CycleValue rechaza distribución inconsistente', () => {
    expect(() => new CycleValue({ grossARS: 1000, commissionARS: 200, workerARS: 900 }))
      .toThrow('inconsistente');
  });

  test('rehydrate() reconstruye ciclo completo desde eventos', () => {
    const original = TerritorialCycle.start(BASE);
    original.reserveOffer({ offerId: 'offer-001', unitsReserved: 1 });
    original.assignDistribution({ nodeId: 'node-001' });
    original.assignWorker({ workerId: 'worker-001' });
    original.startExecution();
    original.complete({ grossARS: 20000, commissionARS: 2400, workerARS: 17600 });
    const events = original.pullDomainEvents();
    const rebuilt = TerritorialCycle.rehydrate(events);
    expect(rebuilt.status.value).toBe('COMPLETED');
    expect(rebuilt.value.workerARS).toBe(17600);
    expect(rebuilt.version).toBe(6);
  });

  test('start() sin zonaId lanza error', () => {
    expect(() => TerritorialCycle.start({ ...BASE, zonaId: null })).toThrow('zonaId requerido');
  });
});
