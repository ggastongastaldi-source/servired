'use strict';
/**
 * AdvanceCycle — avanza un TerritorialCycle al siguiente estado.
 * step: 'RESERVE_OFFER' | 'ASSIGN_DISTRIBUTION' | 'ASSIGN_WORKER' | 'START' | 'COMPLETE' | 'CANCEL'
 */
class AdvanceCycle {
  constructor({ unitOfWork }) { this._uow = unitOfWork; }

  async execute({ cycleId, step, payload = {} }) {
    const cycle = await this._uow.cycles.findById(cycleId);
    if (!cycle) throw new Error(`TerritorialCycle no encontrado: ${cycleId}`);

    switch (step) {
      case 'RESERVE_OFFER':
        cycle.reserveOffer({ offerId: payload.offerId, unitsReserved: payload.unitsReserved || 1 });
        break;
      case 'ASSIGN_DISTRIBUTION':
        cycle.assignDistribution({ nodeId: payload.nodeId });
        break;
      case 'ASSIGN_WORKER':
        cycle.assignWorker({ workerId: payload.workerId });
        break;
      case 'START':
        cycle.startExecution();
        break;
      case 'COMPLETE':
        cycle.complete({ grossARS: payload.grossARS, commissionARS: payload.commissionARS, workerARS: payload.workerARS });
        break;
      case 'CANCEL':
        cycle.cancel({ reason: payload.reason });
        break;
      default:
        throw new Error(`Step desconocido: ${step}`);
    }

    await this._uow.cycles.save(cycle);
    await this._uow.commit();

    this._uow.registerIntegrationEvents([{
      type: `CycleAdvanced_${step}`, cycleId,
      status: cycle.status.value, payload,
      occurredAt: new Date().toISOString(),
    }]);
    await this._uow.publish();
    return { cycleId, status: cycle.status.value };
  }
}
module.exports = { AdvanceCycle };
