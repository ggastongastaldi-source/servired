'use strict';

const { IUnitOfWork } = require('../../domain/ports/IUnitOfWork');

class UnitOfWork extends IUnitOfWork {
  constructor({ trustProfileRepository, riskCaseRepository, publisher }) {
    super();
    this._trustProfileRepository = trustProfileRepository;
    this._riskCaseRepository     = riskCaseRepository;
    this._publisher              = publisher;
    this._integrationEvents      = [];
  }
  get trustProfiles() { return this._trustProfileRepository; }
  get riskCases()     { return this._riskCaseRepository; }
  registerIntegrationEvents(events) { this._integrationEvents.push(...events); }
  async commit() {}
  async publish() {
    if (!this._integrationEvents.length) return;
    await this._publisher.publish(this._integrationEvents);
    this._integrationEvents = [];
  }
  async rollback() { this._integrationEvents = []; }
}

module.exports = { UnitOfWork };
