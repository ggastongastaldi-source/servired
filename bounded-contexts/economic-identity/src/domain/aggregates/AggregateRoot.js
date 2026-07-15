'use strict';
class AggregateRoot {
  constructor() {
    this._domainEvents = [];
    this._version      = 0;
    this._uncommitted  = 0;
  }
  get version()         { return this._version; }
  get expectedVersion() { return this._version; }
  _recordEvent(event) {
    this._domainEvents.push(event);
    this._applyEvent(event);
    this._uncommitted++;
  }
  _applyEvent(event) {
    throw new Error(`${this.constructor.name}._applyEvent() must be implemented`);
  }
  _rehydrate(events) {
    for (const event of events) {
      this._applyEvent(event);
      this._version++;
    }
  }
  pullDomainEvents() {
    const events = [...this._domainEvents];
    this._domainEvents = [];
    this._uncommitted  = 0;
    return events;
  }
}
module.exports = { AggregateRoot };
