class IIntegrationEventPublisher {
  async publish(events) { throw new Error('not implemented'); }
  async publishOne(event) { return this.publish([event]); }
}
module.exports = { IIntegrationEventPublisher };
