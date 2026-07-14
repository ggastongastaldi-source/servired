'use strict';

const { RiskCaseNotFoundError } = require('../../domain/errors');

/**
 * ResolveRiskCase — Use Case
 * Cierra un RiskCase con una resolución: CLEARED | CONFIRMED | DEFERRED
 */
class ResolveRiskCase {

  constructor({ unitOfWork, clock }) {
    this._uow   = unitOfWork;
    this._clock = clock;
  }

  async execute({ riskCaseId, resolution }) {
    const riskCase = await this._uow.riskCases.findById(riskCaseId);
    if (!riskCase) throw new RiskCaseNotFoundError(riskCaseId);

    riskCase.resolve({ resolution, clock: this._clock });
    await this._uow.riskCases.save(riskCase);
    await this._uow.commit();
    await this._uow.publish();

    return { riskCaseId, resolution, resolvedAt: this._clock.now().toISOString() };
  }
}

module.exports = { ResolveRiskCase };
