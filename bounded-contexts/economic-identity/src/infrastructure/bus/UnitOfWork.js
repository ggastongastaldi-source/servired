'use strict';
class UnitOfWork {
  constructor({ actorRepository, publisher }) {
    this._actorRepo = actorRepository;
    this._publisher = publisher;
    this._integrationEvents = [];
  }
  get actors() { return this._actorRepo; }
  registerIntegrationEvents(events) { this._integrationEvents.push(...events); }
  async commit() {}
  async publish() {
    if (!this._integrationEvents.length || !this._publisher) return;
    for (const e of this._integrationEvents) await this._publisher(e);
    this._integrationEvents = [];
  }
  async rollback() { this._integrationEvents = []; }
}
module.exports = { UnitOfWork };
