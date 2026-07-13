class ITrustEventStore {
  async append(aggregateId, events, expectedVersion) { throw new Error('ITrustEventStore.append() must be implemented'); }
  async getStream(aggregateId, fromVersion = 0) { throw new Error('ITrustEventStore.getStream() must be implemented'); }
  async getByTypes(eventTypes, fromDate) { throw new Error('ITrustEventStore.getByTypes() must be implemented'); }
  async countEvents(aggregateId) { throw new Error('ITrustEventStore.countEvents() must be implemented'); }
}
module.exports = { ITrustEventStore };
